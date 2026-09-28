import type { OfferEvent, OfferThread } from '@/types';
import { formatCurrency } from '@/lib/utils/format';

export const offerStatusText: Record<OfferThread['status'], string> = {
  ACTIVE: 'Aktif', ACCEPTED: 'Kabul edildi', REJECTED: 'Reddedildi', WITHDRAWN: 'Geri çekildi', EXPIRED: 'Yanıt süresi doldu', CLOSED: 'Görüşme kapandı',
};

export function isSystemOfferEvent(event: OfferEvent) {
  return event.event_type === 'LISTING_PRICE_CHANGED' || event.event_type === 'THREAD_CLOSED';
}

export function offerEventCopy(event: OfferEvent) {
  const amount = event.amount ? formatCurrency(event.amount) : '';
  if (event.event_type === 'OFFER_CREATED') return `Bu ilan için teklifim ${amount}.`;
  if (event.event_type === 'COUNTER_OFFER_CREATED') return `Teklifine karşılık teklifim ${amount}.`;
  if (event.event_type === 'ACCEPTED') return 'Teklifini kabul ediyorum.';
  if (event.event_type === 'REJECTED') return 'Teklif reddedildi.';
  if (event.event_type === 'WITHDRAWN') return 'Teklif geri çekildi.';
  if (event.event_type === 'LISTING_PRICE_CHANGED') return `İlan fiyatı ${formatCurrency(Number(event.metadata?.oldPrice || 0))} → ${formatCurrency(Number(event.metadata?.newPrice || 0))} olarak değiştirildi.`;
  return 'İlan artık aktif olmadığı için bu teklif görüşmesi kapandı.';
}

export function latestOfferSummary(thread: OfferThread) {
  const event = thread.events?.at(-1);
  return event ? offerEventCopy(event) : `${formatCurrency(thread.current_amount)} teklif`;
}