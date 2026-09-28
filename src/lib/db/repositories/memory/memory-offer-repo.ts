import { IOfferRepository } from '../types';
import { db } from '../../store';
import { OfferCloseReason, OfferEvent, OfferThread } from '@/types';
import { getEffectiveListingStatus } from '@/lib/listings/visibility';
import { OFFER_MAX_ACTIVE_THREADS_PER_BUYER, OFFER_MAX_AMOUNT, OFFER_MAX_NEW_THREADS_PER_HOUR, OFFER_MAX_PRICE_MOVEMENTS, OFFER_PAGE_SIZE, OFFER_REOPEN_COOLDOWN_MINUTES, OFFER_RESPONSE_HOURS } from '@/lib/offers/constants';
import { createNotification } from '../../notifications';

const terminal = new Set(['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'CLOSED']);
const nowIso = () => new Date().toISOString();
const expiryIso = () => new Date(Date.now() + OFFER_RESPONSE_HOURS * 3600000).toISOString();

export class MemoryOfferRepository implements IOfferRepository {
  private event(thread: OfferThread, event_type: OfferEvent['event_type'], actor_profile_id?: string | null, amount?: number | null, metadata?: Record<string, unknown>) {
    const latestTimestamp = Math.max(
      Date.now(),
      ...db.offerEvents.filter((event) => event.thread_id === thread.id).map((event) => new Date(event.created_at).getTime() + 1),
      thread.buyer_last_read_at ? new Date(thread.buyer_last_read_at).getTime() + 1 : 0,
      thread.seller_last_read_at ? new Date(thread.seller_last_read_at).getTime() + 1 : 0,
    );
    const row: OfferEvent = { id: `oe-${Date.now()}-${Math.random()}`, thread_id: thread.id, actor_profile_id, event_type, amount, metadata, created_at: new Date(latestTimestamp).toISOString() };
    db.offerEvents.push(row); return row;
  }
  private expire(thread: OfferThread) {
    if (thread.status === 'ACTIVE' && new Date(thread.expires_at).getTime() <= Date.now()) {
      thread.status = 'EXPIRED'; thread.turn_profile_id = null; thread.updated_at = nowIso(); this.event(thread, 'THREAD_CLOSED', null, null, { reason: 'RESPONSE_EXPIRED' });
    }
  }
  private hydrate(thread: OfferThread, actorProfileId: string): OfferThread {
    this.expire(thread);
    const listing = db.listings.find(l => l.id === thread.listing_id)!;
    const buyer = db.profiles.find(p => p.id === thread.buyer_profile_id);
    const seller = db.profiles.find(p => p.id === thread.seller_profile_id);
    const side = actorProfileId === thread.buyer_profile_id ? 'BUYER' : 'SELLER';
    const readAt = side === 'BUYER' ? thread.buyer_last_read_at : thread.seller_last_read_at;
    const events = db.offerEvents.filter(e => e.thread_id === thread.id);
    return { ...thread, listing, buyer, seller, events, actor_side: side, unread_count: events.filter(e => e.actor_profile_id !== actorProfileId && (!readAt || e.created_at > readAt)).length };
  }
  async createOffer({ listingId, amount, actorProfileId, actorUserId }: { listingId: string; amount: number; actorProfileId: string; actorUserId: string }) {
    const listing = db.listings.find(l => l.id === listingId); const buyer = db.profiles.find(p => p.id === actorProfileId);
    if (!listing || !buyer) return { success: false, code: 'NOT_FOUND', error: 'İlan bulunamadı.' };
    if (getEffectiveListingStatus(listing) !== 'ACTIVE') return { success: false, code: 'LISTING_INACTIVE', error: 'İlan yayında olmadığı için teklif verilemez.' };
    if (listing.offers_enabled === false) return { success: false, code: 'OFFERS_DISABLED', error: 'Bu ilan tekliflere kapalı.' };
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > OFFER_MAX_AMOUNT) return { success: false, code: 'INVALID_AMOUNT', error: 'Geçerli bir teklif tutarı girin.' };
    if (listing.minimum_offer_amount && amount < listing.minimum_offer_amount) return { success: false, code: 'BELOW_MINIMUM', error: `Satıcı bu ilan için $${listing.minimum_offer_amount.toLocaleString('tr-TR')} altında teklif kabul etmiyor.` };
    const sellerProfileId = listing.seller_type === 'CORPORATE' ? db.dealers.find(d => d.id === listing.corporate_profile_id)?.owner_profile_id : listing.seller_profile_id;
    const seller = db.profiles.find(p => p.id === sellerProfileId);
    if (!seller) return { success: false, error: 'Satıcı bulunamadı.' };
    if (seller.user_id === actorUserId) return { success: false, code: 'SELF_OFFER', error: 'Kendi hesabınıza ait ilana teklif veremezsiniz.' };
    const existing = db.offerThreads.find(t => t.listing_id === listingId && t.buyer_profile_id === actorProfileId && t.status === 'ACTIVE');
    if (existing) return { success: true, thread: this.hydrate(existing, actorProfileId), code: 'EXISTING_ACTIVE' };
    const cooldown = db.offerThreads.filter(t => t.listing_id === listingId && t.buyer_profile_id === actorProfileId && terminal.has(t.status)).sort((a,b)=>b.updated_at.localeCompare(a.updated_at))[0];
    if (cooldown && Date.now() - new Date(cooldown.updated_at).getTime() < OFFER_REOPEN_COOLDOWN_MINUTES * 60000) return { success: false, code: 'COOLDOWN', error: 'Bu ilan için yeni teklif vermeden önce 30 dakika beklemelisiniz.' };
    if (db.offerThreads.filter(t => t.buyer_profile_id === actorProfileId && t.status === 'ACTIVE').length >= OFFER_MAX_ACTIVE_THREADS_PER_BUYER) return { success: false, code: 'ACTIVE_LIMIT', error: 'Aynı anda en fazla 10 aktif teklif görüşmeniz olabilir.' };
    if (db.offerThreads.filter(t => t.buyer_profile_id === actorProfileId && Date.now() - new Date(t.created_at).getTime() < 3600000).length >= OFFER_MAX_NEW_THREADS_PER_HOUR) return { success: false, code: 'RATE_LIMIT', error: 'Saatlik yeni teklif limitine ulaştınız.' };
    const time = nowIso(); const thread: OfferThread = { id: `ot-${Date.now()}-${Math.random()}`, listing_id: listingId, buyer_profile_id: actorProfileId, seller_profile_id: seller.id, seller_corporate_profile_id: listing.corporate_profile_id || null, current_amount: amount, status: 'ACTIVE', close_reason: null, turn_profile_id: seller.id, movement_count: 1, expires_at: expiryIso(), buyer_last_read_at: time, seller_last_read_at: null, created_at: time, updated_at: time };
    db.offerThreads.push(thread); this.event(thread, 'OFFER_CREATED', actorProfileId, amount);
    await createNotification({ recipient_profile_id: seller.id, user_id: seller.user_id, type: 'OFFER_ACTIVITY' as any, title: 'Yeni teklif geldi', message: `${buyer.full_name} ${listing.title} ilanına teklif verdi.`, entity_type: 'offer' as any, entity_id: thread.id, metadata: { offerThreadId: thread.id } });
    return { success: true, thread: this.hydrate(thread, actorProfileId) };
  }
  async listOffers({ actorProfileId, box = 'received', status, cursor, limit = OFFER_PAGE_SIZE }: any) {
    let rows = db.offerThreads.filter(t => box === 'sent' ? t.buyer_profile_id === actorProfileId : t.seller_profile_id === actorProfileId);
    rows.forEach(t => this.expire(t)); if (status) rows = rows.filter(t => t.status === status); if (cursor) rows = rows.filter(t => t.updated_at < cursor);
    rows.sort((a,b)=>b.updated_at.localeCompare(a.updated_at)); const page = rows.slice(0, Math.min(limit, OFFER_PAGE_SIZE));
    return { threads: page.map(t => this.hydrate(t, actorProfileId)), nextCursor: rows.length > page.length ? page.at(-1)?.updated_at : null };
  }
  async getOffer(threadId: string, actorProfileId: string) { const t = db.offerThreads.find(x=>x.id===threadId); if (!t || (t.buyer_profile_id!==actorProfileId && t.seller_profile_id!==actorProfileId)) return { success:false,error:'Teklif bulunamadı.' }; return { success:true,thread:this.hydrate(t,actorProfileId) }; }
  async actOnOffer({ threadId, actorProfileId, action, amount }: any) {
    const t=db.offerThreads.find(x=>x.id===threadId); if(!t||(t.buyer_profile_id!==actorProfileId&&t.seller_profile_id!==actorProfileId)) return {success:false,error:'Teklif bulunamadı.'}; this.expire(t);
    const listing=db.listings.find(l=>l.id===t.listing_id); if(!listing||getEffectiveListingStatus(listing)!=='ACTIVE') return {success:false,code:'LISTING_INACTIVE',error:'İlan yayında olmadığı için işlem yapılamaz.'}; if(t.status!=='ACTIVE') return {success:false,error:'Bu teklif artık aktif değil.'};
    const isBuyer=actorProfileId===t.buyer_profile_id; const other=isBuyer?t.seller_profile_id:t.buyer_profile_id;
    if(action==='WITHDRAW'){if(!isBuyer)return{success:false,error:'Yalnız alıcı teklifi geri çekebilir.'};t.status='WITHDRAWN';t.turn_profile_id=null;this.event(t,'WITHDRAWN',actorProfileId);}
    else {if(t.turn_profile_id!==actorProfileId)return{success:false,error:'Bu teklifte yanıt sırası sizde değil.'}; if(action==='COUNTER'){if(t.movement_count>=OFFER_MAX_PRICE_MOVEMENTS)return{success:false,code:'MOVEMENT_LIMIT',error:'Bu teklif görüşmesinde maksimum karşı teklif sayısına ulaşıldı.'};if(!Number.isSafeInteger(amount)||amount<=0||amount>OFFER_MAX_AMOUNT)return{success:false,error:'Geçerli bir teklif tutarı girin.'};if(listing.minimum_offer_amount&&amount<listing.minimum_offer_amount)return{success:false,error:`Satıcı bu ilan için $${listing.minimum_offer_amount.toLocaleString('tr-TR')} altında teklif kabul etmiyor.`};t.current_amount=amount;t.movement_count++;t.turn_profile_id=other;t.expires_at=expiryIso();this.event(t,'COUNTER_OFFER_CREATED',actorProfileId,amount);} else {t.status=action==='ACCEPT'?'ACCEPTED':'REJECTED';t.turn_profile_id=null;this.event(t,action==='ACCEPT'?'ACCEPTED':'REJECTED',actorProfileId,t.current_amount);}}
    t.updated_at=nowIso(); const target=db.profiles.find(p=>p.id===other); if(target) await createNotification({recipient_profile_id:target.id,user_id:target.user_id,type:'OFFER_ACTIVITY' as any,title:'Teklif güncellendi',message:`${listing.title} ilanındaki teklif görüşmesinde yeni hareket var.`,entity_type:'offer' as any,entity_id:t.id,metadata:{offerThreadId:t.id}}); return {success:true,thread:this.hydrate(t,actorProfileId)};
  }
  async markRead(threadId:string,actorProfileId:string){const t=db.offerThreads.find(x=>x.id===threadId);if(!t||(t.buyer_profile_id!==actorProfileId&&t.seller_profile_id!==actorProfileId))return{success:false,unreadCount:0,error:'Teklif bulunamadı.'};const latestEvent=Math.max(Date.now(),...db.offerEvents.filter(e=>e.thread_id===threadId).map(e=>new Date(e.created_at).getTime()+1));const readAt=new Date(latestEvent).toISOString();if(t.buyer_profile_id===actorProfileId)t.buyer_last_read_at=readAt;else t.seller_last_read_at=readAt;return{success:true,unreadCount:await this.getUnreadCount(actorProfileId)};}
  async getUnreadCount(actorProfileId:string){return db.offerThreads.filter(t=>t.buyer_profile_id===actorProfileId||t.seller_profile_id===actorProfileId).reduce((n,t)=>n+(this.hydrate(t,actorProfileId).unread_count||0),0);}
  async getActiveCountForListing(listingId:string,actorProfileId:string){const listing=db.listings.find(l=>l.id===listingId);if(!listing)return 0;const sellerId=listing.seller_type==='CORPORATE'?db.dealers.find(d=>d.id===listing.corporate_profile_id)?.owner_profile_id:listing.seller_profile_id;if(sellerId!==actorProfileId)return 0;return db.offerThreads.filter(t=>t.listing_id===listingId&&t.status==='ACTIVE').length;}
  async expireStale(){let count=0;for(const t of db.offerThreads.filter(x=>x.status==='ACTIVE')){const listing=db.listings.find(l=>l.id===t.listing_id);if(listing&&getEffectiveListingStatus(listing)!=='ACTIVE'){await this.closeForListing(t.listing_id,'LISTING_EXPIRED');count++;continue;}if(new Date(t.expires_at).getTime()<=Date.now()){this.expire(t);count++;}}return count;}
  async closeForListing(listingId:string,reason:OfferCloseReason){let n=0;const listing=db.listings.find(l=>l.id===listingId);for(const t of db.offerThreads.filter(x=>x.listing_id===listingId&&x.status==='ACTIVE')){t.status='CLOSED';t.close_reason=reason;t.turn_profile_id=null;t.updated_at=nowIso();this.event(t,'THREAD_CLOSED',null,null,{reason});for(const profileId of [t.buyer_profile_id,t.seller_profile_id]){const target=db.profiles.find(p=>p.id===profileId);if(target)await createNotification({recipient_profile_id:target.id,user_id:target.user_id,type:'OFFER_ACTIVITY',title:'Teklif görüşmesi kapandı',message:reason==='LISTING_REMOVED_BY_ADMIN'?'İlan yönetim tarafından yayından kaldırıldı. Bu teklif görüşmesi artık devam ettirilemez.':`${listing?.title||'İlan'} yayında olmadığı için bu teklif kapandı.`,entity_type:'offer',entity_id:t.id,metadata:{offerThreadId:t.id,eventType:'THREAD_CLOSED',reason}});}n++;}return n;}
  async recordListingPriceChange(listingId:string,oldPrice:number,newPrice:number){let n=0;const listing=db.listings.find(l=>l.id===listingId);for(const t of db.offerThreads.filter(x=>x.listing_id===listingId&&x.status==='ACTIVE')){this.event(t,'LISTING_PRICE_CHANGED',null,null,{oldPrice,newPrice});t.updated_at=nowIso();for(const profileId of [t.buyer_profile_id,t.seller_profile_id]){const target=db.profiles.find(p=>p.id===profileId);if(target)await createNotification({recipient_profile_id:target.id,user_id:target.user_id,type:'OFFER_ACTIVITY',title:'İlan fiyatı değişti',message:`${listing?.title||'İlan'} fiyatı güncellendi.`,entity_type:'offer',entity_id:t.id,metadata:{offerThreadId:t.id,eventType:'LISTING_PRICE_CHANGED',oldPrice,newPrice}});}n++;}return n;}
}