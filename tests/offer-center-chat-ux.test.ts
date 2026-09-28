import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { offerEventCopy } from '@/lib/offers/presentation';

const source = (path: string) => readFileSync(path, 'utf8');
const center = source('src/components/offers/OfferCenter.tsx');
const styles = source('src/app/globals.css');

describe('OfferCenter chat UX', () => {
  test('floating messenger shell has animated open and closed states with mobile layout', () => {
    assert.match(center, /offer-launcher/);
    assert.match(center, /data-state=\{open\?'open':'closed'\}/);
    assert.match(center, /opacity-100 translate-y-0 scale-100/);
    assert.match(center, /opacity-0 translate-y-3 scale-\[\.97\]/);
    assert.match(center, /h-\[min\(92dvh,760px\)\]/);
    assert.match(center, /sm:w-\[420px\]/);
    assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*offer-panel/);
  });

  test('list and thread render chat metadata, unread state, avatars and directional events', () => {
    assert.match(center, /data-offer-view="list"/);
    assert.match(center, /latestOfferSummary\(row\)/);
    assert.match(center, /row\.unread_count/);
    assert.match(center, /function Avatar/);
    assert.match(center, /data-offer-event=\{own \? 'own' : 'counterparty'\}/);
    assert.match(center, /data-offer-event="system"/);
  });

  test('structured events use Turkish messenger copy', () => {
    const event = (event_type: any, amount?: number, metadata?: Record<string, unknown>) => ({ id: 'e', thread_id: 't', event_type, amount, metadata, created_at: '' });
    assert.equal(offerEventCopy(event('OFFER_CREATED', 90000)), 'Bu ilan için teklifim $90.000.');
    assert.equal(offerEventCopy(event('COUNTER_OFFER_CREATED', 95000)), 'Teklifine karşılık teklifim $95.000.');
    assert.equal(offerEventCopy(event('ACCEPTED')), 'Teklifini kabul ediyorum.');
    assert.equal(offerEventCopy(event('REJECTED')), 'Teklif reddedildi.');
    assert.match(offerEventCopy(event('LISTING_PRICE_CHANGED', undefined, { oldPrice: 100000, newPrice: 90000 })), /\$100\.000 → \$90\.000/);
    assert.match(offerEventCopy(event('THREAD_CLOSED')), /artık aktif olmadığı/);
  });

  test('listing integration reuses an active thread and no freeform chat exists', () => {
    assert.match(center, /threadForListing/);
    assert.match(center, /if\(response\.ok&&data\.thread\)/);
    assert.match(center, /Teklif tutarın/);
    assert.match(center, /Karşı teklifin/);
    assert.doesNotMatch(center, /Mesajını yaz|emoji|attachment|type="file"/i);
  });

  test('dashboard navigation is removed and participant hide is server verified', () => {
    assert.doesNotMatch(source('src/app/hesabim/layout.tsx'), /href: '\/hesabim\/teklifler'/);
    assert.match(source('src/app/api/offers/[id]/route.ts'), /resolveOwnedActiveProfile/);
    assert.match(source('src/app/api/offers/[id]/route.ts'), /hideOffer\(id,actor\.profileId\)/);
    assert.doesNotMatch(source('src/lib/db/repositories/memory/memory-offer-repo.ts') + source('src/lib/db/repositories/supabase/supabase-offer-repo.ts'), /test-login:account:|John Doe|Jane Doe/);
  });
});