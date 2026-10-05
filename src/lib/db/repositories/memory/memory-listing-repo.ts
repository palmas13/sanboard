import { IListingRepository, CreateListingInput, ListingPublishOptions } from '../types';
import {
  getPublicListings,
  getListingById,
  createListingWithCredit,
  updateListing,
  markListingAsSold,
  republishListing,
  getUserListings,
  toggleFavorite,
  getUserFavorites,
  ListingFilterParams,
} from '../../listings';
import { db } from '../../store';

export class MemoryListingRepository implements IListingRepository {
  async getPublicListings(params?: ListingFilterParams) {
    return getPublicListings(params);
  }

  async getSimilarListings(currentListingId: string, limit?: number) {
    const { getSimilarListings: fetchSimilar } = await import('../../listings');
    return fetchSimilar(currentListingId, limit);
  }

  async getCompareListings(ids: string[]) {
    const { getCompareListings: fetchCompare } = await import('../../listings');
    return fetchCompare(ids);
  }

  async getPropertyCompareListings(ids: string[]) {
    const { getPropertyCompareListings: fetchCompare } = await import('../../listings');
    return fetchCompare(ids);
  }

  async getListingById(id: string, viewerProfileId?: string, viewerUserId?: string) {
    return getListingById(id, viewerProfileId, viewerUserId);
  }

  async getListingByPublicId(publicId: string, viewerProfileId?: string, viewerUserId?: string) {
    const listing = db.listings.find((item) => item.public_id === publicId);
    return listing
      ? getListingById(listing.id, viewerProfileId, viewerUserId)
      : { listing: null, isLocked: false, isOwner: false };
  }

  async createListing(input: CreateListingInput, profileId: string, options?: ListingPublishOptions) {
    return createListingWithCredit(input as any, profileId, options);
  }

  async updateListing(id: string, input: Partial<CreateListingInput>, profileId: string, userId?: string, role?: string) {
    return updateListing(id, input as any, profileId, userId, role);
  }

  async markListingAsSold(id: string, profileId: string) {
    return markListingAsSold(id, profileId);
  }

  async closeListing(id: string, profileId: string, status: 'SOLD' | 'REMOVED', _closeReason?: 'SOLD' | 'CANCELLED' | 'OTHER') {
    const result = status === 'SOLD'
      ? await markListingAsSold(id, profileId)
      : await (await import('../../listings')).removeListing(id, profileId);
    const listing = result.success ? db.listings.find((item) => item.id === id) : undefined;
    return { ...result, listing };
  }

  async republishListing(id: string, profileId: string) {
    return republishListing(id, profileId);
  }

  async transitionFreezeState(id:string,profileId:string,userId:string,action:'FREEZE'|'RESUME'){
    const listing=db.listings.find((item)=>item.id===id);if(!listing)return{success:false,code:'NOT_FOUND',error:'İlan bulunamadı.'};
    const owner=listing.seller_type==='CORPORATE'?db.dealers.find((item)=>item.id===listing.corporate_profile_id)?.owner_profile_id:listing.seller_profile_id;if(owner!==profileId)return{success:false,code:'FORBIDDEN',error:'Bu işlem için yetkiniz yok.'};
    const now=new Date();const desired=action==='FREEZE'?'FROZEN':'ACTIVE';if(listing.status===desired)return{success:true,idempotent:true,listingId:id,status:desired as 'ACTIVE'|'FROZEN',frozenAt:listing.frozen_at,remainingListingSeconds:listing.remaining_listing_seconds,remainingBoostSeconds:listing.remaining_boost_seconds,expiresAt:listing.expires_at,boostExpiresAt:listing.featured_until};
    const last=listing.last_freeze_transition_at?new Date(listing.last_freeze_transition_at).getTime():0;if(last+60000>now.getTime())return{success:false,code:'LISTING_TRANSITION_COOLDOWN',error:'İlan durumu yeniden değiştirilmeden önce kısa bir süre beklemelisiniz.',retryAfterSeconds:Math.ceil((last+60000-now.getTime())/1000)};
    if(action==='FREEZE'){if(listing.status!=='ACTIVE')return{success:false,code:'INVALID_LISTING_STATE',error:'Yalnızca aktif ilanlar dondurulabilir.'};const seconds=Math.ceil((new Date(listing.expires_at||0).getTime()-now.getTime())/1000);if(seconds<=0)return{success:false,code:'LISTING_ALREADY_EXPIRED',error:'Süresi dolmuş ilan dondurulamaz.'};listing.remaining_listing_seconds=seconds;listing.remaining_boost_seconds=listing.is_featured&&listing.featured_until?Math.max(0,Math.ceil((new Date(listing.featured_until).getTime()-now.getTime())/1000)):0;listing.status='FROZEN';listing.frozen_at=now.toISOString();listing.last_freeze_transition_at=now.toISOString();listing.freeze_count=(listing.freeze_count||0)+1;listing.is_featured=false;listing.featured_until=null;}
    else{if(listing.status!=='FROZEN')return{success:false,code:'INVALID_LISTING_STATE',error:'Yalnızca dondurulmuş ilanlar yeniden aktif edilebilir.'};const seconds=listing.remaining_listing_seconds||0;if(seconds<=0)return{success:false,code:'LISTING_ALREADY_EXPIRED',error:'Kalan süresi olmayan ilan yeniden aktif edilemez.'};if(listing.seller_type==='CORPORATE'){const dealer=db.dealers.find((item)=>item.id===listing.corporate_profile_id);if(!dealer||dealer.subscription_status!=='ACTIVE'||!dealer.subscription_expires_at||new Date(dealer.subscription_expires_at)<=now||dealer.moderation_status!=='ACTIVE')return{success:false,code:'CORPORATE_SUBSCRIPTION_REQUIRED',error:'İlanı yeniden aktifleştirmek için kurumsal üyeliğiniz aktif olmalıdır.'};}listing.status='ACTIVE';listing.frozen_at=null;listing.expires_at=new Date(now.getTime()+seconds*1000).toISOString();listing.featured_until=(listing.remaining_boost_seconds||0)>0?new Date(now.getTime()+listing.remaining_boost_seconds!*1000).toISOString():null;listing.is_featured=Boolean(listing.featured_until);listing.last_freeze_transition_at=now.toISOString();listing.resume_count=(listing.resume_count||0)+1;}
    listing.updated_at=now.toISOString();db.auditLogs.push({id:`audit-${Date.now()}`,event_type:action==='FREEZE'?'LISTING_FROZEN':'LISTING_RESUMED',user_id:userId,profile_id:profileId,metadata:{listing_id:id,remaining_listing_seconds:listing.remaining_listing_seconds,remaining_boost_seconds:listing.remaining_boost_seconds,source:'OWNER'},created_at:now.toISOString()});return{success:true,listingId:id,status:listing.status as 'ACTIVE'|'FROZEN',frozenAt:listing.frozen_at,remainingListingSeconds:listing.remaining_listing_seconds,remainingBoostSeconds:listing.remaining_boost_seconds,expiresAt:listing.expires_at,boostExpiresAt:listing.featured_until,cooldownUntil:new Date(now.getTime()+60000).toISOString()};
  }

  async getUserListings(
    profileId: string,
    onTiming?: (
      stage: 'query' | 'enrichment_query' | 'enrich_map' | 'enrich' | 'map',
      duration: number
    ) => void
  ) {
    const queryStartedAt = performance.now();
    let listings;
    try {
      listings = await getUserListings(profileId);
    } finally {
      onTiming?.('query', performance.now() - queryStartedAt);
    }
    return listings;
  }

  async clearUserListingHistory(profileId: string, status: 'EXPIRED' | 'SOLD') {
    const profile = db.profiles.find((item) => item.id === profileId);
    if (!profile) return { success: false, error: 'Profil bulunamadı.' };
    const clearedAt = new Date().toISOString();
    if (status === 'EXPIRED') profile.expired_listing_history_cleared_at = clearedAt;
    else profile.sold_listing_history_cleared_at = clearedAt;
    profile.updated_at = clearedAt;
    return { success: true, clearedAt };
  }

  async getCorporateListings(
    corporateProfileId: string,
    onTiming?: (stage: 'db' | 'enrich', duration: number) => void
  ) {
    const { getCorporateListings: fetchCorporate } = await import('../../listings');
    const dbStartedAt = performance.now();
    let listings;
    try {
      listings = await fetchCorporate(corporateProfileId);
    } finally {
      onTiming?.('db', performance.now() - dbStartedAt);
    }
    const enrichStartedAt = performance.now();
    try {
      return listings;
    } finally {
      onTiming?.('enrich', performance.now() - enrichStartedAt);
    }
  }

  async toggleFavorite(listingId: string, profileId: string) {
    return toggleFavorite(profileId, listingId);
  }

  async setFavorite(listingId: string, profileId: string, isFavorited: boolean) {
    const existing = (await this.getFavoriteStates([listingId], profileId))[listingId]?.isFavorited;
    if (existing !== isFavorited) {
      return toggleFavorite(profileId, listingId);
    }
    return {
      isFavorited,
      count: (await this.getFavoriteStates([listingId], profileId))[listingId]?.count || 0,
    };
  }

  async removeFavorite(listingId: string, profileId: string) {
    const res = await toggleFavorite(profileId, listingId);
    if (res.isFavorited) {
      const secondRes = await toggleFavorite(profileId, listingId);
      return { success: true, count: secondRes.count };
    }
    return { success: true, count: res.count };
  }

  async getUserFavorites(profileId: string) {
    return getUserFavorites(profileId);
  }

  async getFavoriteStates(listingIds: string[], profileId?: string) {
    const { db } = await import('../../store');
    const ids = new Set(listingIds);
    const states: Record<string, { isFavorited: boolean; count: number }> = {};
    for (const listingId of ids) {
      const rows = db.favorites.filter((favorite) => favorite.listing_id === listingId);
      states[listingId] = {
        isFavorited: Boolean(profileId && rows.some((favorite) => favorite.profile_id === profileId)),
        count: rows.length,
      };
    }
    return states;
  }

  async removeListing(id: string, profileId: string) {
    const { removeListing } = await import('../../listings');
    return removeListing(id, profileId);
  }
}
