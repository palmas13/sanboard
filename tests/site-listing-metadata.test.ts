import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createListingShareData, GENERIC_SHARE_DATA, getListingShareDescription } from '@/lib/seo/listing-share';
import { SITE_DESCRIPTION, SITE_TITLE } from '@/lib/seo/site-metadata';

const base = {
  id: 'listing-id',
  public_id: '482731',
  listing_number: '#SB-482731',
  seller_type: 'INDIVIDUAL' as const,
  title: 'Premium ilan',
  price: 210000,
  published_at: '2026-09-28T12:00:00.000Z',
  favorite_count: 0,
  is_locked: true as const,
  status: 'ACTIVE' as const,
};

describe('site and listing share metadata', () => {
  test('homepage metadata uses the requested brand copy without GTA World', () => {
    assert.equal(SITE_TITLE, "Sanboard – Los Santos'un İlan Platformu");
    assert.equal(SITE_DESCRIPTION, "Los Santos'ta araç ve mülk ilanlarını keşfet, ilanını yayınla ve doğru alıcıyla buluş.");
    const layout = readFileSync('src/app/layout.tsx', 'utf8');
    assert.doesNotMatch(layout, /GTA World/);
    assert.match(layout, /summary_large_image/);
  });

  test('vehicle description uses price, category and date without a false location', () => {
    const listing = { ...base, category: 'vehicle' as const, subcategory: 'Otomobil', location: 'Otomobil', cover_image: 'listings/a/cover.webp' };
    assert.equal(getListingShareDescription(listing), '$210.000 · Otomobil · 28 Eylül 2026');
    const share = createListingShareData(listing)!;
    assert.equal(share.location, undefined);
    assert.equal(share.coverImage, 'https://cdn.sanboard.xyz/listings/a/cover.webp');
    assert.equal(share.ogImage, 'https://sanboard.xyz/ilan/premium-ilan-482731/opengraph-image');
  });

  test('property description and OG data include the real location', () => {
    const listing = { ...base, category: 'property' as const, subcategory: 'Ev / Daire', location: 'West Vinewood', price: 320000 };
    const share = createListingShareData(listing)!;
    assert.equal(share.description, '$320.000 · Ev / Daire · West Vinewood · 28 Eylül 2026');
    assert.equal(share.location, 'West Vinewood');
  });

  test('missing image keeps branded OG route and renderer supplies branded fallback', () => {
    const listing = { ...base, category: 'vehicle' as const, subcategory: 'Otomobil', location: null };
    const share = createListingShareData(listing)!;
    assert.equal(share.coverImage, undefined);
    assert.match(readFileSync('src/components/seo/SanboardOgImage.tsx', 'utf8'), /sanboard\.xyz/);
    assert.match(readFileSync('src/app/ilan/[id]/opengraph-image.tsx', 'utf8'), /SanboardOgImage/);
  });

  test('non-public listings are rejected and invalid routes have generic metadata', () => {
    const draft = { ...base, category: 'property' as const, subcategory: 'Ev / Daire', location: 'Private', status: 'DRAFT' as const };
    assert.equal(createListingShareData(draft), null);
    assert.equal(GENERIC_SHARE_DATA.title, SITE_TITLE);
    assert.equal(GENERIC_SHARE_DATA.ogImage, 'https://sanboard.xyz/opengraph-image');
  });

  test('listing metadata declares branded Open Graph and Twitter large images', () => {
    const page = readFileSync('src/app/ilan/[id]/page.tsx', 'utf8');
    assert.match(page, /openGraph:/);
    assert.match(page, /twitter:/);
    assert.match(page, /card: 'summary_large_image'/);
    assert.match(page, /images: \[share\.ogImage\]/);
    assert.doesNotMatch(page, /ilanını Sanboard üzerinde inceleyin/);
  });
});