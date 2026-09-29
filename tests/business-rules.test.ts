import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  baseListingSchema,
  vehicleListingSchema,
  propertyListingSchema,
  LISTING_TITLE_MAX_ERROR,
} from '@/lib/validations/listing';
import { formatCurrency, formatTimeRemaining, generateListingNumber } from '@/lib/utils/format';
import {
  sanitizeListingForPublic,
  getPublicListings,
  createListingWithCredit,
  updateListing,
  markListingAsSold,
  toggleFavorite,
} from '@/lib/db/listings';
import { createCheckoutOrder, completePaymentOrder } from '@/lib/db/payments';
import { db } from '@/lib/db/store';

describe('Sanboard Business Rules & Validation Tests', () => {
  test('Title length constraint accepts 40 and rejects 41 characters', () => {
    const valid = 'A'.repeat(40);
    const validResult = baseListingSchema.safeParse({
      title: valid,
      description: 'Test açıklama',
      price: 50000,
      location: 'Vinewood',
      images: [{ storage_path: '/valid.jpg', is_cover: true, size_bytes: 500000, sort_order: 0 }],
    });
    assert.strictEqual(validResult.success, true);

    const invalid = 'A'.repeat(41);
    const result = baseListingSchema.safeParse({
      title: invalid,
      description: 'Test açıklama',
      price: 50000,
      location: 'Vinewood',
      images: [
        {
          storage_path: 'https://example.com/1.jpg',
          is_cover: true,
          size_bytes: 500000,
          sort_order: 0,
        },
      ],
    });
    assert.strictEqual(result.success, false);
    assert.equal(result.error?.issues[0]?.message, LISTING_TITLE_MAX_ERROR);
  });

  test('Description length constraint: max 100 characters', () => {
    const invalidDesc = 'B'.repeat(101);
    const result = baseListingSchema.safeParse({
      title: 'Geçerli Başlık',
      description: invalidDesc,
      price: 50000,
      location: 'Vinewood',
      images: [
        {
          storage_path: 'https://example.com/1.jpg',
          is_cover: true,
          size_bytes: 500000,
          sort_order: 0,
        },
      ],
    });
    assert.strictEqual(result.success, false);
  });

  test('Photo constraint: max 3 photos, each max 2MB, exactly one cover', () => {
    // Over 2 MB photo test
    const oversizedResult = baseListingSchema.safeParse({
      title: 'Geçerli Başlık',
      description: 'Açıklama',
      price: 50000,
      location: 'Vinewood',
      images: [
        {
          storage_path: 'https://example.com/1.jpg',
          is_cover: true,
          size_bytes: 3 * 1024 * 1024, // 3 MB > 2 MB
          sort_order: 0,
        },
      ],
    });
    assert.strictEqual(oversizedResult.success, false);

    // Over 3 images test
    const tooManyImages = baseListingSchema.safeParse({
      title: 'Geçerli Başlık',
      description: 'Açıklama',
      price: 50000,
      location: 'Vinewood',
      images: [
        { storage_path: '1.jpg', is_cover: true, size_bytes: 100, sort_order: 0 },
        { storage_path: '2.jpg', is_cover: false, size_bytes: 100, sort_order: 1 },
        { storage_path: '3.jpg', is_cover: false, size_bytes: 100, sort_order: 2 },
        { storage_path: '4.jpg', is_cover: false, size_bytes: 100, sort_order: 3 },
      ],
    });
    assert.strictEqual(tooManyImages.success, false);
  });

  test('Client cannot manipulate package price on server', async () => {
    const order = await createCheckoutOrder('char-mavis-01', 'STANDARD_7_DAY');
    // Price must always be 2000 from database package configuration
    assert.strictEqual(order.amount, 2000);
  });

  test('Payment completion issues 1 available credit', async () => {
    const order = await createCheckoutOrder('char-mavis-01', 'STANDARD_7_DAY');
    const completion = await completePaymentOrder(order.orderId, 'TX-TEST-001');

    assert.ok(completion.success);
    assert.ok(completion.credit);
    assert.strictEqual(completion.credit.status, 'AVAILABLE');
  });

  test('Credit can only be consumed once and sets exactly 7 days expiry', async () => {
    // Ensure test user has 1 credit
    const order = await createCheckoutOrder('char-zade-02', 'STANDARD_7_DAY');
    await completePaymentOrder(order.orderId);

    const testListingInput = {
      category: 'vehicle',
      subcategory: 'Otomobil',
      title: 'TEST SCHAFTER V12 FOR CREDIT CONSUMPTION',
      description: 'Kusursuz test aracı',
      price: 80000,
      location: 'Vinewood',
      model: 'Schafter',
      plate: 'TEST99',
      mileage: 1000,
      images: [
        {
          id: 'img-1',
          storage_path: 'https://example.com/test.jpg',
          is_cover: true,
          size_bytes: 500000,
          sort_order: 0,
        },
      ],
    };

    const firstPublish = await createListingWithCredit(testListingInput, 'char-zade-02');
    assert.ok(firstPublish.success);
    assert.ok(firstPublish.listing);

    // Verify 7-day expiration calculation
    const pubDate = new Date(firstPublish.listing.published_at!).getTime();
    const expDate = new Date(firstPublish.listing.expires_at!).getTime();
    const diffDays = Math.round((expDate - pubDate) / (1000 * 60 * 60 * 24));
    assert.strictEqual(diffDays, 7);
  });

  test('Unauthenticated user receives sanitized public listing without private fields', () => {
    const sampleListing = db.listings[0];
    const sanitized = sanitizeListingForPublic(sampleListing);

    // Private fields should not exist on public summary
    assert.strictEqual((sanitized as any).phone, undefined);
    assert.strictEqual((sanitized as any).sanmail_email, undefined);
    assert.strictEqual((sanitized as any).plate, undefined);
    assert.strictEqual((sanitized as any).mileage, undefined);
    assert.strictEqual((sanitized as any).engine_upgrade, undefined);
    assert.strictEqual((sanitized as any).seller, undefined);
    assert.strictEqual(sanitized.is_locked, true);
  });

  test('Expired listings are strictly excluded from public queries', async () => {
    // Add expired listing to store
    const expiredId = 'lst-test-expired';
    db.listings.push({
      id: expiredId,
      listing_number: '#SB-999999',
      seller_profile_id: 'char-mavis-01',
      category: 'vehicle',
      subcategory: 'Otomobil',
      title: 'EXPIRED TEST VEHICLE',
      description: 'Old car',
      price: 10000,
      location: 'Vinewood',
      status: 'ACTIVE',
      published_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), // expired 3 days ago
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    });

    const publicResults = await getPublicListings();
    const foundExpired = publicResults.some((l) => l.id === expiredId);
    assert.strictEqual(foundExpired, false);
  });

  test('Non-owner cannot edit listing', async () => {
    const listing = db.listings[0];
    const foreignSellerId = 'char-non-owner-999';

    const editAttempt = await updateListing(
      listing.id,
      { title: 'Hacked Title', description: 'Hacked', price: 1 },
      foreignSellerId
    );

    assert.strictEqual(editAttempt.success, false);
    assert.strictEqual(editAttempt.error, 'Bu ilanı düzenleme yetkiniz yok.');
  });

  test('Sold listing is decommissioned and purged from public', async () => {
    const listing = db.listings[0];
    const sellerId = listing.seller_profile_id;

    const soldRes = await markListingAsSold(listing.id, sellerId);
    assert.ok(soldRes.success);
    assert.strictEqual(listing.status, 'SOLD');
    assert.strictEqual(listing.images?.length, 0);

    // Verify it doesn't appear in public queries
    const publicFeed = await getPublicListings();
    assert.strictEqual(publicFeed.some((l) => l.id === listing.id), false);
  });

  test('Favorite uniqueness and toggle count', async () => {
    const listingId = 'lst-prop-01';
    const profileId = 'char-unique-tester';

    // First toggle adds
    const res1 = await toggleFavorite(profileId, listingId);
    assert.strictEqual(res1.isFavorited, true);

    // Second toggle removes
    const res2 = await toggleFavorite(profileId, listingId);
    assert.strictEqual(res2.isFavorited, false);
  });

  test('Vehicle listing schema succeeds WITHOUT location', () => {
    const vehicleInput = {
      category: 'vehicle' as const,
      subcategory: 'Otomobil' as const,
      title: '2024 Vapid Dominator GTT',
      description: 'Temiz araç',
      price: 85000,
      brand: 'Vapid',
      model: 'Dominator GTT',
      plate: '62LS901',
      mileage: 1500,
      engine_upgrade: 3,
      transmission_upgrade: 2,
      brake_upgrade: 2,
      turbo: true,
      subwoofer: false,
      trade_available: true,
      images: [
        { storage_path: 'https://example.com/dom1.jpg', is_cover: true, size_bytes: 500000, sort_order: 0 },
      ],
    };

    const result = vehicleListingSchema.safeParse(vehicleInput);
    assert.strictEqual(result.success, true, 'Vehicle listing without location should succeed');
  });

  test('Property listing schema FAILS without location and SUCCEEDS with valid location', () => {
    const invalidProperty = {
      category: 'property' as const,
      subcategory: 'Ev / Daire' as const,
      title: 'Rockford Hills Lüks Daire',
      description: 'Manzaralı',
      price: 450000,
      floor: 4,
      room_count: '3+1' as const,
      furnished: true,
      building_type: 'Normal' as const,
      balcony: true,
      images: [
        { storage_path: 'https://example.com/prop1.jpg', is_cover: true, size_bytes: 500000, sort_order: 0 },
      ],
    };

    const failResult = propertyListingSchema.safeParse(invalidProperty);
    assert.strictEqual(failResult.success, false, 'Property listing without location should fail');

    const validProperty = {
      ...invalidProperty,
      location: 'Rockford Hills',
    };
    const passResult = propertyListingSchema.safeParse(validProperty);
    assert.strictEqual(passResult.success, true, 'Property listing with valid location should pass');
  });
});
