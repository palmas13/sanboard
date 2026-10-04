import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/db/store';
import { getPublicListings } from '@/lib/db/listings';
import { formatTurkishInteger, isIntegerInRange, normalizeIntegerInput, normalizeTurkishIntegerInput } from '@/lib/forms/integer-input';
import { sortPublicListings } from '@/lib/listings/public-sort';
import { listingUnionSchema } from '@/lib/validations/listing';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const vehiclePayload = (extra: Record<string, unknown> = {}) => ({
  category: 'vehicle', subcategory: 'Otomobil', title: 'Test ilanı', description: '', price: 1000,
  images: [{ storage_path: '/test.jpg', sort_order: 0, is_cover: true, size_bytes: 100 }],
  brand: 'Dinka', model: 'Blista', plate: 'TEST01', mileage: 10,
  engine_upgrade: 0, transmission_upgrade: 0, brake_upgrade: 0,
  turbo: false, subwoofer: false, trade_available: false,
  ...extra,
});

describe('listing discovery and form improvements', () => {
  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    db.listings = [];
    db.favorites = [];
    db.dealers = [];
  });

  test('engine health is an integer from 0 to 100 and factory price is a positive integer', () => {
    assert.equal(listingUnionSchema.safeParse(vehiclePayload({ engine_health: 0, factory_price: 1 })).success, true);
    assert.equal(listingUnionSchema.safeParse(vehiclePayload({ engine_health: 100, factory_price: 85000 })).success, true);
    for (const engine_health of [-1, 101, 99.5]) {
      assert.equal(listingUnionSchema.safeParse(vehiclePayload({ engine_health })).success, false);
    }
    for (const factory_price of [0, -1, 10.5]) {
      assert.equal(listingUnionSchema.safeParse(vehiclePayload({ factory_price })).success, false);
    }
  });

  test('Turkish money formatting keeps canonical raw digits and rejects invalid pasted characters', () => {
    assert.equal(normalizeTurkishIntegerInput('125.000'), '125000');
    assert.equal(formatTurkishInteger('125000'), '125.000');
    assert.equal(normalizeTurkishIntegerInput('12a500'), null);
    assert.equal(normalizeIntegerInput('10.5'), null);
    assert.equal(normalizeIntegerInput('00100'), '100');
    assert.equal(isIntegerInRange('100', 0, 100), true);
    assert.equal(isIntegerInRange('101', 0, 100), false);
  });

  test('selected live sort orders price, date and favorite totals after featured priority', () => {
    const rows = [
      { id: 'old', price: 300, published_at: '2026-09-01T00:00:00.000Z', favorite_count: 8 },
      { id: 'new', price: 100, published_at: '2026-09-20T00:00:00.000Z', favorite_count: 2 },
      { id: 'featured', price: 200, published_at: '2026-09-10T00:00:00.000Z', favorite_count: 1, is_featured: true },
    ];
    assert.deepEqual(sortPublicListings(rows, 'price_asc').map((row) => row.id), ['featured', 'new', 'old']);
    assert.deepEqual(sortPublicListings(rows, 'newest').map((row) => row.id), ['featured', 'new', 'old']);
    assert.deepEqual(sortPublicListings(rows, 'oldest').map((row) => row.id), ['featured', 'old', 'new']);
    assert.deepEqual(sortPublicListings(rows, 'popular').map((row) => row.id), ['featured', 'old', 'new']);
  });

  test('mileage, turbo, subwoofer and trade filters apply to the complete memory dataset', async () => {
    const now = new Date('2026-09-30T12:00:00.000Z');
    const future = new Date('2026-10-07T12:00:00.000Z').toISOString();
    db.listings = [
      { id: 'matching', listing_number: '#1', seller_profile_id: 'p1', seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Matching', description: '', price: 100, location: null, status: 'ACTIVE', published_at: now.toISOString(), expires_at: future, created_at: now.toISOString(), updated_at: now.toISOString(), images: [], vehicle_details: { listing_id: 'matching', vehicle_category: 'Otomobil', brand: 'Dinka', model: 'Blista', plate: 'A', mileage: 5000, engine_upgrade: 0, transmission_upgrade: 0, brake_upgrade: 0, turbo: true, subwoofer: true, trade_available: true } },
      { id: 'other', listing_number: '#2', seller_profile_id: 'p2', seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Other', description: '', price: 200, location: null, status: 'ACTIVE', published_at: now.toISOString(), expires_at: future, created_at: now.toISOString(), updated_at: now.toISOString(), images: [], vehicle_details: { listing_id: 'other', vehicle_category: 'Otomobil', brand: 'Dinka', model: 'Blista', plate: 'B', mileage: 15000, engine_upgrade: 0, transmission_upgrade: 0, brake_upgrade: 0, turbo: false, subwoofer: false, trade_available: false } },
    ] as any;

    const results = await getPublicListings({ category: 'vehicle', minMileage: 1000, maxMileage: 10000, turbo: 'yes', subwoofer: 'yes', trade: 'yes' });
    assert.deepEqual(results.map((listing) => listing.id), ['matching']);
  });

  test('listing views reveal eight items at a time and UI refinements reuse shared components', () => {
    for (const path of ['src/components/listings/VehicleListingsView.tsx', 'src/components/listings/PropertyListingsView.tsx']) {
      const view = source(path);
      assert.match(view, /const PAGE_SIZE = 8/);
      assert.match(view, /slice\(0, visibleCount\)/);
      assert.match(view, /count \+ PAGE_SIZE/);
      assert.match(view, /Daha Fazla Göster/);
    }

    const badge = source('src/components/listings/FeaturedBadge.tsx');
    assert.match(badge, /aria-label="Öne çıkan ilan"/);
    assert.match(badge, /<Rocket/);
    assert.doesNotMatch(badge, /Sparkles/);
    assert.doesNotMatch(badge, />\s*ÖNE ÇIKAN\s*</);

    const application = source('src/app/hesabim/kurumsal/basvuru/page.tsx');
    assert.match(application, /FaqAccordion/);
    assert.match(application, /<FaqAccordion items=\{applicationFaq\} \/>/);
    assert.match(application, /Kurumsal başvuru hakkında/);
  });

  test('create and edit forms keep formatted money display with raw values and no example input placeholders', () => {
    for (const path of ['src/app/ilan-ver/yeni/page.tsx', 'src/app/hesabim/ilanlarim/[id]/duzenle/page.tsx']) {
      const form = source(path);
      assert.match(form, /formatTurkishInteger\(price\)/);
      assert.match(form, /normalizeTurkishIntegerInput/);
      assert.match(form, /inputMode="numeric"/);
      assert.doesNotMatch(form, /placeholder="(?:Örn|75000|4200|62LS901|100|1)"/);
    }
  });
});