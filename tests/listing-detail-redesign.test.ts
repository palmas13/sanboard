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
  const favorite = source('src/components/listings/FavoriteButton.tsx');
  const corporate = source('src/app/hesabim/kurumsal/page.tsx');

  test('vehicle and property details use distinct responsive marketplace layouts', () => {
    assert.match(page, /data-testid="vehicle-listing-layout"/);
    assert.match(page, /max-w-\[1580px\]/);
    assert.match(page, /xl:grid-cols-\[minmax\(0,1\.55fr\)_minmax\(360px,\.9fr\)_minmax\(245px,\.58fr\)\]/);
    assert.match(page, /data-testid="property-listing-layout"/);
    assert.match(page, /lg:grid-cols-\[minmax\(0,1\.5fr\)_minmax\(380px,1fr\)\]/);
    assert.match(page, /data-testid="vehicle-gallery-block"[^>]*>[\s\S]*?<ListingGallery/);
    assert.match(page, /data-testid="vehicle-description-row"[^>]*xl:col-start-1[^>]*>[\s\S]*?<ListingDescription/);
    assert.match(page, /data-testid="vehicle-technical-column"[^>]*xl:col-start-2[^>]*xl:row-span-2[^>]*>[\s\S]*?<VehicleDetailsPanel/);
    assert.match(page, /data-testid="vehicle-seller-rail"[^>]*xl:col-start-3[^>]*xl:sticky[^>]*>[\s\S]*?<SellerArea/);
    assert.ok(page.indexOf('data-testid="vehicle-seller-rail"') < page.indexOf('data-testid="vehicle-description-row"'));
    assert.match(page, /data-testid="property-gallery-block"[^>]*>[\s\S]*?<ListingGallery/);
    assert.match(page, /data-testid="property-right-column"[^>]*lg:sticky[^>]*>[\s\S]*?<PropertyDetailsPanel[\s\S]*?<SellerArea/);
    assert.match(page, /data-testid="property-description-row"[^>]*>[\s\S]*?<ListingDescription/);
    assert.doesNotMatch(page, /min-h-\[calc\(100vh-5rem\)\]/);
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
    assert.match(safety, /data-testid="safe-shopping-card"/);
    assert.match(safety, /Güvenli alışveriş:/);
    assert.doesNotMatch(safety, /shadow-/);
  });

  test('favorite counts synchronize between mounted controls and corporate manage links retain listing context', () => {
    assert.match(favorite, /favoriteCountSubscribers/);
    assert.match(favorite, /subscribeFavoriteCount\(listingId/);
    assert.match(corporate, /searchParams\.get\('listing'\)/);
    assert.match(corporate, /id="ilanlar"/);
    assert.match(corporate, /managedListingId === l\.id/);
  });

  test('optional fields are conditional and property fields use real listing data', () => {
    assert.match(header, /listing\.location \?/);
    assert.doesNotMatch(header, /listing\.subcategory/);
    assert.match(property, /value: listing\.location/);
    assert.match(property, /details\.property_type/);
    assert.match(property, /details\.room_count/);
    assert.match(property, /details\.building_type/);
    assert.doesNotMatch(property, /Belirtilmemiş/);
  });

  test('motorcycle suspension is hidden, ATV remains eligible, and levels are labelled', () => {
    assert.match(vehicle, /details\.vehicle_category !== 'Motosiklet'/);
    assert.match(vehicle, /numericValue >= 0 && numericValue <= 4/);
    assert.match(vehicle, /`Seviye \$\{numericValue\}`/);
    assert.doesNotMatch(vehicle, /vehicle_category === 'ATV'/);
    assert.doesNotMatch(vehicle, /Seviye Spor/);
  });

  test('gallery renders thumbnails, counter, arrows and click-to-open keyboard controls without a redundant expand icon', () => {
    assert.match(gallery, /data-testid="listing-gallery"/);
    assert.match(gallery, /aria-label="İlan fotoğrafları"/);
    assert.match(gallery, /selectedIdx \+ 1/);
    assert.match(gallery, /ArrowLeft/);
    assert.match(gallery, /ArrowRight/);
    assert.match(gallery, /Escape/);
    assert.match(gallery, /quality=\{92\}/);
    assert.match(gallery, /useCallback/);
    assert.doesNotMatch(gallery, /<Expand/);
  });

  test('favorite, share and report actions remain available in the header', () => {
    assert.match(page, /data-testid="listing-actions"/);
    assert.match(page, /FavoriteButton/);
    assert.match(page, /CopyListingLinkButton/);
    assert.match(page, /ReportModal/);
    assert.match(page, /ListingDetailHeader/);
  });

  test('minimum offer copy is conditional and below-minimum input is blocked client-side', () => {
    assert.match(offer, /compose\.minimum && <p[^>]*>Minimum teklif:/);
    assert.match(offer, /Bu ilan için minimum teklif tutarı/);
    assert.match(offer, /disabled=\{busy \|\| !amount \|\| belowMinimum\}/);
  });
});