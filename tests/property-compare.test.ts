import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addPropertyCompareItem, MAX_PROPERTY_COMPARE_ITEMS } from '@/components/compare/PropertyCompareContext';
import { getPropertyComparisonRows } from '@/components/compare/PropertyComparisonGrid';
import { getPropertyCompareListings } from '@/lib/db/listings';
import { db } from '@/lib/db/store';
import type { Listing } from '@/types';

const property = (id: string, status: Listing['status'] = 'ACTIVE'): Listing => ({
  id,
  public_id: `58${id.slice(-4).padStart(4, '0')}`,
  listing_number: `#${id}`,
  seller_profile_id: 'property-compare-seller',
  seller_type: 'INDIVIDUAL',
  category: 'property',
  subcategory: 'Ev / Daire',
  title: `Mülk ${id}`,
  description: 'Karşılaştırma testi',
  price: 100000 + Number(id.replace(/\D/g, '') || 0),
  location: 'Vinewood',
  status,
  published_at: '2026-09-20T12:00:00.000Z',
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  created_at: '2026-09-20T12:00:00.000Z',
  updated_at: '2026-09-20T12:00:00.000Z',
  property_details: {
    listing_id: id,
    property_type: 'Ev / Daire',
    floor: 3,
    room_count: '2+1',
    furnished: true,
    building_type: 'Normal',
    balcony: true,
  },
});

describe('property comparison', () => {
  const originalListings = db.listings;
  const originalProfiles = db.profiles;

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    db.profiles = [{ id: 'property-compare-seller', user_id: 'account', full_name: 'Property Seller', avatar_url: '', sanmail_email: '', phone: '', created_at: '', updated_at: '' }];
    db.listings = [property('property-1'), property('property-2'), property('property-3')];
  });

  afterEach(() => {
    db.listings = originalListings;
    db.profiles = originalProfiles;
  });

  test('2 property compare preserves both selections and existing property fields', async () => {
    const result = await getPropertyCompareListings(['property-1', 'property-2']);
    assert.equal(result.filter(Boolean).length, 2);
    const rows = getPropertyComparisonRows(result.filter((item): item is Listing => Boolean(item)));
    assert.deepEqual(rows.map((row) => row.key), ['price', 'location', 'property-type', 'seller', 'published-at', 'room-count', 'floor', 'building-type', 'furnished', 'balcony']);
  });

  test('3 property compare is supported', async () => {
    const result = await getPropertyCompareListings(['property-1', 'property-2', 'property-3']);
    assert.equal(result.filter(Boolean).length, 3);
    assert.equal(MAX_PROPERTY_COMPARE_ITEMS, 3);
  });

  test('4th property selection is rejected', () => {
    const result = addPropertyCompareItem(['property-1', 'property-2', 'property-3'], 'property-4');
    assert.equal(result.success, false);
    assert.equal(result.reason, 'LIMIT_REACHED');
    assert.equal(result.ids.length, 3);
  });

  test('duplicate property selection is rejected', () => {
    const result = addPropertyCompareItem(['property-1', 'property-2'], 'property-2');
    assert.equal(result.success, false);
    assert.equal(result.reason, 'ALREADY_ADDED');
    assert.deepEqual(result.ids, ['property-1', 'property-2']);
  });

  test('inactive properties cannot be compared', async () => {
    db.listings.push(property('property-draft', 'DRAFT'), property('property-sold', 'SOLD'), property('property-removed', 'REMOVED'), { ...property('property-expired'), expires_at: new Date(Date.now() - 1000).toISOString() });
    const result = await getPropertyCompareListings(['property-draft', 'property-sold', 'property-removed', 'property-expired']);
    assert.deepEqual(result, [null, null, null, null]);
  });

  test('mobile comparison uses responsive stacked cards without a classic overflowing table', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/compare/PropertyComparisonGrid.tsx'), 'utf8');
    assert.match(source, /grid-cols-1/);
    assert.match(source, /sm:grid-cols-3/);
    assert.match(source, /data-testid="property-comparison-stacked"/);
    assert.doesNotMatch(source, /<table|overflow-x-auto|min-w-\[/);
    assert.doesNotMatch(source, /winner|score/i);
  });

  test('grid and list property compare actions stay inside a shared normal-flow action slot', () => {
    const gridCard = readFileSync(join(process.cwd(), 'src/components/listings/ListingCard.tsx'), 'utf8');
    const listRow = readFileSync(join(process.cwd(), 'src/components/listings/PropertyListingRow.tsx'), 'utf8');
    const button = readFileSync(join(process.cwd(), 'src/components/compare/PropertyCompareButton.tsx'), 'utf8');

    assert.match(gridCard, /data-testid="listing-card"/);
    assert.match(gridCard, /data-testid="property-compare-action-slot"/);
    assert.match(gridCard, /flex justify-end border-t/);
    assert.doesNotMatch(gridCard, /absolute bottom-\[4\.35rem\]/);
    assert.match(listRow, /data-testid="property-listing-row"/);
    assert.match(listRow, /data-testid="property-compare-action-slot"/);
    assert.match(listRow, /flex shrink-0 flex-wrap items-center justify-end/);
    assert.match(button, /data-testid="property-compare-button"/);
    assert.match(button, /shrink-0/);
    assert.match(button, /Karşılaştırmadan çıkar/);
    assert.match(button, /added \? 'border/);
  });

  test('home listing cards hide compare actions while property listings keep the default action', () => {
    const homePage = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8');
    const popularShowcase = readFileSync(join(process.cwd(), 'src/components/home/PopularShowcase.tsx'), 'utf8');
    const listingCard = readFileSync(join(process.cwd(), 'src/components/listings/ListingCard.tsx'), 'utf8');
    const propertyListings = readFileSync(join(process.cwd(), 'src/components/listings/PropertyListingsView.tsx'), 'utf8');

    assert.equal((homePage.match(/showCompare=\{false\}/g) || []).length, 2);
    assert.match(popularShowcase, /<ListingCard[^>]+showCompare=\{false\}/);
    assert.match(listingCard, /showCompare = true/);
    assert.match(listingCard, /showCompare && listing\.category === 'property'/);
    assert.doesNotMatch(propertyListings, /showCompare=\{false\}/);
  });
});
