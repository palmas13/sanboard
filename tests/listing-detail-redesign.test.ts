import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('premium listing detail redesign', () => {
  const page = source('src/app/ilan/[id]/page.tsx');
  const vehicle = source('src/components/listings/detail/VehicleDetailsPanel.tsx');
  const property = source('src/components/listings/detail/PropertyDetailsPanel.tsx');
  const gallery = source('src/components/listings/ListingGallery.tsx');
  const seller = source('src/components/listings/SellerCard.tsx');
  const header = source('src/components/listings/detail/ListingDetailHeader.tsx');
  const safety = source('src/components/listings/detail/SafeShoppingCard.tsx');
  const offer = source('src/components/offers/OfferCenter.tsx');
  const similar = source('src/components/listings/SimilarListings.tsx');
  const similarCard = source('src/components/listings/SimilarListingCard.tsx');
  const favorite = source('src/components/listings/FavoriteButton.tsx');
  const corporate = source('src/app/hesabim/kurumsal/page.tsx');
  const layout = source('src/components/listings/detail/ListingDetailLayout.tsx');

  test('vehicle and property details share the same responsive marketplace layout', () => {
    assert.match(page, /<ListingDetailLayout/);
    assert.match(page, /max-w-\[1580px\]/);
    assert.match(layout, /data-testid="vehicle-listing-layout"/);
    assert.match(layout, /data-testid="vehicle-content-column"[\s\S]*data-testid="vehicle-gallery-block"[\s\S]*data-testid="vehicle-description-row"/);
    assert.match(layout, /xl:grid-cols-\[minmax\(0,1\.7fr\)_minmax\(340px,\.95fr\)_minmax\(260px,\.7fr\)\]/);
    assert.match(layout, /data-testid="vehicle-technical-column"/);
    assert.match(layout, /data-testid="vehicle-seller-rail"/);
    assert.match(layout, /data-testid="property-listing-layout"/);
    assert.match(layout, /xl:grid-cols-\[minmax\(0,1\.7fr\)_minmax\(300px,1fr\)_minmax\(260px,\.75fr\)\]/);
    assert.match(layout, /data-testid="property-gallery-block"/);
    assert.match(layout, /data-testid="property-technical-column"[^>]*xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:self-stretch/);
    assert.match(layout, /data-testid="property-seller-rail"/);
    assert.match(layout, /data-testid="property-description-row"[^>]*xl:col-start-1 xl:row-start-2/);
    assert.match(page, /isVehicle \? <VehicleDetailsPanel[\s\S]*: <PropertyDetailsPanel/);
    assert.match(page, /variant=\{isVehicle \? 'vehicle' : 'property'\}/);
    assert.doesNotMatch(page, /min-h-\[calc\(100vh-5rem\)\]/);
    assert.doesNotMatch(layout, /h-\[\d|min-h-\[\d/);
  });

  test('price and header actions remain centered in the emphasized price block', () => {
    assert.match(header, /items-center justify-center[\s\S]*text-center/);
    assert.match(header, /text-\[34px\][\s\S]*sm:text-\[38px\][\s\S]*xl:text-\[40px\]/);
    assert.match(header, /mt-4 flex w-full justify-center/);
    assert.match(page, /data-testid="listing-actions"[^>]*justify-center/);
  });

  test('vehicle technical information is grouped inside one outer panel', () => {
    assert.match(vehicle, /data-testid="vehicle-details-panel"/);
    assert.doesNotMatch(vehicle, />Teknik Özellikler</);
    assert.match(vehicle, /<TechnicalSection title="Temel Bilgiler"/);
    assert.match(vehicle, /<TechnicalSection title="Mekanik Durum"/);
    assert.match(vehicle, /<TechnicalSection title="Güvenlik Donanımı"/);
    assert.match(vehicle, /<TechnicalSection title="Ek Donanım"/);
    assert.doesNotMatch(vehicle, /label: 'Kategori'/);
    assert.doesNotMatch(vehicle, /label: 'İlan Tarihi'/);
    assert.doesNotMatch(vehicle, /label: 'Yakıt Türü'/);
    assert.doesNotMatch(vehicle, /<ListingInfoSection/);
  });

  test('seller variations and owner/offer actions retain canonical behavior', () => {
    assert.match(seller, /data-testid=\{isCorporate \? 'corporate-seller-card' : 'individual-seller-card'\}/);
    assert.match(seller, /dealer\?\.phone/);
    assert.match(seller, /seller\?\.phone/);
    assert.match(page, /listing\.seller_type === 'CORPORATE' \? `\/hesabim\/kurumsal\?listing=/);
    assert.match(page, /`\/hesabim\/ilanlarim\/\$\{listing\.id\}\/duzenle`/);
    assert.match(page, /listing\.offers_enabled !== false \? <OfferButton/);
    assert.match(seller, /Kurumsal Profil/);
    assert.doesNotMatch(seller, /Premium Satıcı|Onaylı Kurumsal Profil|Kurumsal Satıcı|Mesaj Gönder|İletişim Kur|Satıcıyla İletişime Geç/);
    assert.match(seller, /dealer\?\.address/);
    assert.match(seller, /isCorporate && dealer\?\.is_verified \? <BadgeCheck/);
    assert.match(seller, /Doğrulanmış kurumsal profil/);
    assert.doesNotMatch(seller, /Doğrulanmış mağaza/);
    assert.match(safety, /data-testid="safe-shopping-card"/);
    assert.match(safety, /Güvenli alışveriş:/);
    assert.match(safety, /Hızlı Karşılaştır/);
    assert.match(safety, /Güvenli Teklif/);
    assert.doesNotMatch(safety, /shadow-/);
  });

  test('favorite counts synchronize between mounted controls and corporate manage links retain listing context', () => {
    assert.match(favorite, /favoriteCountSubscribers/);
    assert.match(favorite, /subscribeFavoriteCount\(listingId/);
    assert.match(corporate, /searchParams\.get\('listing'\)/);
    assert.match(corporate, /id="ilanlar"/);
    assert.match(corporate, /managedListingId === l\.id/);
    assert.match(header, /data-testid="listing-metadata-row"/);
    assert.match(favorite, /data-testid="favorite-metadata"/);
    assert.match(favorite, /\{count\} kişi/);
    assert.match(favorite, /ml-auto shrink-0/);
  });

  test('optional fields are conditional and property fields use real listing data', () => {
    assert.match(header, /listing\.location \?/);
    assert.doesNotMatch(header, /listing\.subcategory/);
    assert.match(property, /value: listing\.location/);
    assert.match(property, /details\.property_type/);
    assert.match(property, /details\.room_count/);
    assert.match(property, /details\.room_number/);
    assert.match(property, /details\.alarm === true \? 'Var' : details\.alarm === false \? 'Yok' : null/);
    assert.match(property, /title="Fiyat ve Ek Bilgiler"/);
    assert.match(property, /Piyasa Fiyatı/);
    assert.doesNotMatch(property, /Market Değeri/);
    assert.match(property, /details\.building_type/);
    assert.doesNotMatch(property, /Belirtilmemiş/);
    assert.match(header, /listing\.category === 'vehicle' && listing\.location/);
    assert.doesNotMatch(header, /listing\.category === 'property' && listing\.location/);
  });

  test('motorcycle suspension is hidden, ATV remains eligible, and levels are labelled', () => {
    assert.match(vehicle, /details\.vehicle_category !== 'Motosiklet'/);
    assert.match(vehicle, /numericValue >= 0 && numericValue <= 4/);
    assert.match(vehicle, /`Seviye \$\{numericValue\}`/);
    assert.doesNotMatch(vehicle, /vehicle_category === 'ATV'/);
    assert.doesNotMatch(vehicle, /Seviye Spor/);
  });

  test('gallery renders counter, arrows and click-to-open keyboard controls without thumbnails or a redundant expand icon', () => {
    assert.match(gallery, /data-testid="listing-gallery"/);
    assert.match(gallery, /aria-label="İlan fotoğrafları"/);
    assert.match(gallery, /selectedIdx \+ 1/);
    assert.match(gallery, /ArrowLeft/);
    assert.match(gallery, /ArrowRight/);
    assert.match(gallery, /Escape/);
    assert.match(gallery, /priority unoptimized onLoad=\{startGalleryPreload\}/);
    assert.match(gallery, /const aspect = variant === 'property'/);
    assert.match(gallery, /\(min-width: 1280px\) 52vw, 100vw/);
    assert.doesNotMatch(gallery, /aspect-\[4\/3\]/);
    assert.match(gallery, /useCallback/);
    assert.doesNotMatch(gallery, /<Expand/);
    assert.doesNotMatch(gallery, /fotoğrafı göster/);
  });

  test('favorite, share and report actions remain available in the header', () => {
    assert.match(page, /data-testid="listing-actions"/);
    assert.match(page, /FavoriteButton/);
    assert.match(page, /CopyListingLinkButton/);
    assert.match(page, /<ReportModal listingId=\{listing\.id\} compact/);
    const headerActionBlock = page.slice(page.indexOf('const headerActions'), page.indexOf('const descriptionReport'));
    assert.doesNotMatch(headerActionBlock, /<ReportModal/);
    assert.match(source('src/components/listings/ReportModal.tsx'), /Bu ilanı raporla\./);
    assert.match(page, /ListingDetailHeader/);
  });

  test('similar listings use the compact horizontal visual and exact title', () => {
    assert.match(similar, />\s*Benzer İlanlar\s*</);
    assert.doesNotMatch(similar, /Benzer İlanları İnceleyin/);
    assert.match(similarCard, /className="flex min-h-32[^\"]*"/);
    assert.match(similarCard, /w-\[42%\]/);
    assert.match(similarCard, /\{listing\.title\}/);
    assert.match(similarCard, /\[listing\.brand, listing\.model\]\.filter\(Boolean\)\.join\(' '\)/);
    assert.match(similarCard, /secondaryText \?/);
    assert.match(similarCard, /formatCurrency\(listing\.price\)/);
    assert.match(similarCard, /href=\{getListingUrl\(listing\)\}/);
    assert.doesNotMatch(similarCard, /undefined undefined/);
  });

  test('similar listings are integrated for vehicle and property details and hidden for empty results', () => {
    assert.match(page, /getOptionalSimilarListings\(repo, listing\.id, 10\)/);
    assert.match(page, /similarListings\.length > 0 \? <SimilarListings/);
    assert.doesNotMatch(page, /isVehicle && similarListings\.length/);
    assert.match(similar, /if \(!listings\.length\) return null/);
  });

  test('carousel preserves manual scrolling, pauses for interaction, and disables autoplay for reduced motion', () => {
    assert.match(similar, /overflow-x-auto/);
    assert.match(similar, /snap-x snap-mandatory/);
    assert.match(similar, /onPointerDown=\{pauseAfterInteraction\}/);
    assert.match(similar, /onTouchStart=\{pauseAfterInteraction\}/);
    assert.match(similar, /onWheel=\{pauseAfterInteraction\}/);
    assert.match(similar, /ArrowRight/);
    assert.match(similar, /ArrowLeft/);
    assert.match(similar, /prefers-reduced-motion: reduce/);
    assert.match(similar, /if \(reducedMotion \|\| isHovering \|\| isFocusWithin \|\| isInteracting/);
    assert.match(similar, /window\.setInterval/);
    assert.doesNotMatch(similar, /listings\.concat|\.map\([^)]*=> listings|clone/i);
  });

  test('minimum offer copy is conditional and below-minimum input is blocked client-side', () => {
    assert.match(offer, /compose\.minimum && <p[^>]*>Minimum teklif:/);
    assert.match(offer, /Bu ilan için minimum teklif tutarı/);
    assert.match(offer, /disabled=\{busy \|\| !amount \|\| belowMinimum\}/);
  });
});