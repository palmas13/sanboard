import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { offerEventCopy } from '@/lib/offers/presentation';

const source = (path: string) => readFileSync(path, 'utf8');
const center = source('src/components/offers/OfferCenter.tsx');
const styles = source('src/app/globals.css');
const offerRoute = source('src/app/api/offers/route.ts');

describe('OfferCenter chat UX', () => {
  test('offer center guidance uses the concise requested copy', () => {
    assert.match(center, /Teklif görüşmelerini bu pencereden görüntüleyebilirsin\./);
    assert.match(center, /Tekliflerindeki son hareketler bu pencerede görünecektir\./);
    assert.doesNotMatch(center, /Yapılandırılmış teklif görüşmeleri|Yeni hareketler burada sohbet listesi gibi görünecek\./);
  });

  test('amount formatter uses Turkish grouping and API receives raw numeric amount', () => {
    assert.equal(formatNumber(2000), '2.000');
    assert.equal(formatNumber(20000), '20.000');
    assert.equal(formatNumber(200000), '200.000');
    assert.equal(formatNumber(2000000), '2.000.000');
    assert.equal(formatCurrency(300000), '$300.000');
    assert.match(center, /inputMode="numeric"/);
    assert.match(center, /pattern="\[0-9\]\*"/);
    assert.match(center, /input\.value\.replace\(\/\\D\/g, ''\)/);
    assert.match(center, /amount: Number\(amount\)/);
    assert.match(center, /formatNumber\(Number\(rawValue\)\)/);
  });

  test('all offer surfaces use the shared currency formatter', () => {
    assert.match(center, /İlan fiyatı: \{formatCurrency\(compose\.price\)\}/);
    assert.match(center, /Minimum teklif: \{formatCurrency\(compose\.minimum\)\}/);
    assert.match(center, /formatCurrency\(thread\.current_amount\)/);
    assert.match(center, /belowMinimum/);
    assert.match(center, /Bu ilan için minimum teklif tutarı \{formatCurrency\(compose\.minimum!\)\}/);
    assert.match(center, /disabled=\{busy \|\| !amount \|\| belowMinimum\}/);
    assert.equal(offerEventCopy({ id: 'e', thread_id: 't', event_type: 'OFFER_CREATED', amount: 300000, created_at: '' }), 'Bu ilan için teklifim $300.000.');
    assert.match(offerEventCopy({ id: 'e', thread_id: 't', event_type: 'LISTING_PRICE_CHANGED', metadata: { oldPrice: 300000, newPrice: 250000 }, created_at: '' }), /\$300\.000 → \$250\.000/);
  });

  test('received and sent tabs have independent unread badges and read refreshes counts', () => {
    assert.match(center, /<TabBadge count=\{unreadCounts\[item\]\}/);
    assert.match(center, /item === 'received' \? 'Aldıklarım' : 'Gönderdiklerim'/);
    assert.match(center, /setRows\(\(previous\) => previous\.map\(\(row\) => row\.id === id \? \{ \.\.\.row, unread_count: 0 \}/);
    assert.match(offerRoute, /getUnreadCounts/);
    assert.match(offerRoute, /unreadCount:counts\.total,unreadCounts:counts/);
  });

  test('thread rows expose balanced metadata, unread styling and isolated trash action', () => {
    assert.match(center, /data-offer-row-meta/);
    assert.match(center, /w-\[92px\]/);
    assert.match(center, /offerStatusText\[row\.status\]/);
    assert.match(center, /aria-label=\{`\$\{person\?\.full_name/);
    assert.match(center, /event\.stopPropagation\(\)/);
    assert.match(center, /bg-\[#FF8A1F\]\/8/);
    assert.match(center, /font-black/);
    assert.match(center, /h-2 w-2[\s\S]*bg-\[#FF8A1F\]/);
    assert.doesNotMatch(center, /href=\{profileUrl\(person\)\}/);
    assert.match(center, /<Avatar profile=\{person\} \/><span className="min-w-0 flex-1">/);
  });

  test('actions preserve hydrated detail by refetching the canonical thread', () => {
    assert.match(center, /const fetchThread = useCallback/);
    assert.match(center, /const hydratedThread = await fetchThread\(threadId\)/);
    assert.match(center, /await hydrateThread\(thread\.id\)/);
    const actionBlock = center.slice(center.indexOf('const act ='), center.indexOf('const closeHideDialog'));
    assert.doesNotMatch(actionBlock, /setThread\(data\.thread\)/);
    for (const action of ['COUNTER', 'ACCEPT', 'REJECT', 'WITHDRAW']) assert.match(center, new RegExp(`'${action}'`));
  });

  test('panel open/close and list/detail transitions are soft and reduced-motion safe', () => {
    assert.match(center, /data-state=\{open \? 'open' : 'closed'\}/);
    assert.match(center, /opacity-100 translate-y-0 scale-100/);
    assert.match(center, /opacity-0 translate-y-2 scale-\[\.985\]/);
    assert.match(center, /setTimeout\(\(\) => setMounted\(false\), 280\)/);
    assert.match(center, /offer-view-forward/);
    assert.match(center, /offer-view-back/);
    assert.match(styles, /transition: opacity 260ms[\s\S]*transform 280ms/);
    assert.match(styles, /@keyframes offer-view-forward/);
    assert.match(styles, /@keyframes offer-view-back/);
    assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*offer-view-forward/);
    assert.match(center, /h-\[min\(92dvh,760px\)\]/);
    assert.match(center, /sm:w-\[420px\]/);
  });

  test('three-dot menu is accessible, clipping-safe and shares a custom hide confirmation modal', () => {
    assert.match(center, /aria-haspopup="menu"/);
    assert.match(center, /aria-expanded=\{menuOpen\}/);
    assert.match(center, /role="menu"/);
    assert.match(center, /z-\[70\]/);
    assert.match(center, /overflow-visible/);
    assert.match(center, /Listeden kaldır/);
    assert.match(center, /requestHide\(thread\.id, true\)/);
    assert.match(center, /method: 'DELETE'/);
    assert.match(center, /role="dialog"/);
    assert.match(center, /aria-modal="true"/);
    assert.match(center, /Teklif görüşmesini kaldır/);
    assert.match(center, /Bu teklif görüşmesi yalnız sizin listenizden kalıcı olarak kaldırılır/);
    assert.match(center, /onMouseDown=\{\(event\) => \{ if \(event\.target === event\.currentTarget\) closeHideDialog\(\); \}\}/);
    assert.match(center, /hideCancelButton\.current\?\.focus\(\)/);
    assert.doesNotMatch(center, /window\.confirm|\bconfirm\(/);
  });

  test('accepted contact card is listing-owner specific and old copy is gone', () => {
    assert.match(center, /data-offer-contact="listing-owner"/);
    assert.match(center, /İlan sahibinin iletişim bilgileri/);
    assert.match(center, /İlan sahibinin görünür iletişim bilgisi bulunmuyor/);
    assert.doesNotMatch(center, /Karşı tarafın görünür iletişim bilgisi bulunmuyor/);
  });

  test('structured-only flow, listing reuse, dashboard removal and generic identity remain intact', () => {
    assert.match(center, /threadForListing/);
    assert.match(center, /response\.ok && data\.thread/);
    assert.match(center, /Teklif tutarın/);
    assert.match(center, /Karşı teklifin/);
    assert.doesNotMatch(center, /Mesajını yaz|emoji|attachment|type="file"/i);
    assert.doesNotMatch(source('src/app/hesabim/layout.tsx'), /href: '\/hesabim\/teklifler'/);
    assert.match(source('src/app/api/offers/[id]/route.ts'), /resolveOwnedActiveProfile/);
    assert.match(source('src/app/api/offers/[id]/route.ts'), /hideOffer\(id,actor\.profileId\)/);
    assert.doesNotMatch(source('src/lib/db/repositories/memory/memory-offer-repo.ts') + source('src/lib/db/repositories/supabase/supabase-offer-repo.ts'), /test-login:account:|John Doe|Jane Doe/);
  });
});