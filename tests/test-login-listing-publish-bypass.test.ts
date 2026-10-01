import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { GET as getCredits } from '@/app/api/credits/route';
import { POST as publishListing } from '@/app/api/listings/route';
import { PUT as updateListing } from '@/app/api/user/listings/[id]/route';
import { POST as boostListing } from '@/app/api/dealers/boost/route';
import { TEST_LOGIN_FIXTURE_ACCOUNT_ID, TEST_LOGIN_CHARACTER_PREFIX } from '@/lib/auth/test-login';

describe('canonical test-login listing publish bypass', () => {
  const now = new Date('2026-09-28T12:00:00.000Z').toISOString();
  const testUserId = '11111111-1111-4111-8111-111111111111';
  const testProfileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const siblingProfileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const normalUserId = '22222222-2222-4222-8222-222222222222';
  const normalProfileId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const adminUserId = '33333333-3333-4333-8333-333333333333';
  const adminProfileId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.ENABLE_TEST_LOGIN = 'true';
    process.env.ENABLE_TEST_PAYMENT_BYPASS = 'true';
    process.env.SANBOARD_SESSION_SECRET = 'test-login-listing-bypass-secret-32-chars';
    db.users = [
      { id: testUserId, provider: 'GTAWORLD', external_user_id: TEST_LOGIN_FIXTURE_ACCOUNT_ID, role: 'USER', status: 'ACTIVE', created_at: now, updated_at: now },
      { id: normalUserId, provider: 'GTAWORLD', external_user_id: 'real-account', role: 'USER', status: 'ACTIVE', created_at: now, updated_at: now },
      { id: adminUserId, provider: 'GTAWORLD', external_user_id: 'real-admin-account', role: 'ADMIN', status: 'ACTIVE', created_at: now, updated_at: now },
    ];
    db.profiles = [
      { id: testProfileId, user_id: testUserId, external_character_id: `${TEST_LOGIN_CHARACTER_PREFIX}mavis-pierce`, full_name: 'Mavis Pierce', avatar_url: '', sanmail_email: '', phone: '', role: 'ADMIN', created_at: now, updated_at: now },
      { id: siblingProfileId, user_id: testUserId, external_character_id: `${TEST_LOGIN_CHARACTER_PREFIX}zade-vexnera`, full_name: 'Zade Vexnera', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: now, updated_at: now },
      { id: normalProfileId, user_id: normalUserId, external_character_id: 'real-mavis-character', full_name: 'Mavis Pierce', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: now, updated_at: now },
      { id: adminProfileId, user_id: adminUserId, external_character_id: 'real-admin-character', full_name: 'Admin Person', avatar_url: '', sanmail_email: '', phone: '', role: 'ADMIN', created_at: now, updated_at: now },
    ] as any;
    db.credits = [];
    db.listings = [];
    db.dealers = [];
    db.favorites = [];
    db.notifications = [];
    db.auditLogs = [];
  });

  function request(profileId: string, userId: string, body: Record<string, unknown>) {
    const token = createSessionToken({ userId, profileId, role: 'USER' });
    return new NextRequest('http://localhost/api/listings', {
      method: 'POST',
      headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function updateRequest(profileId: string, userId: string, listingId: string, body: Record<string, unknown>) {
    const token = createSessionToken({ userId, profileId, role: 'USER' });
    return new NextRequest(`http://localhost/api/user/listings/${listingId}`, {
      method: 'PUT',
      headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function payload(extra: Record<string, unknown> = {}) {
    return {
      category: 'vehicle', subcategory: 'Otomobil', title: 'Test aracı', description: 'Test ilanı', price: 1000,
      images: [{ storage_path: '/test.jpg', sort_order: 0, is_cover: true, size_bytes: 100 }],
      brand: 'Dinka', model: 'Blista', plate: 'TEST01', mileage: 10,
      engine_upgrade: 0, transmission_upgrade: 0, brake_upgrade: 0,
      turbo: false, subwoofer: false, trade_available: false,
      ...extra,
    };
  }

  const imageReferences = (count: number) => Array.from({ length: count }, (_, index) => ({
    storage_path: `listings/${testProfileId}/image-${index}.webp`,
    sort_order: index,
    is_cover: index === 0,
    size_bytes: 120_000,
  }));

  test('canonical test account publishes ACTIVE no-charge listing with correct owner and seven-day expiry', async () => {
    const token = createSessionToken({ userId: testUserId, profileId: testProfileId, role: 'ADMIN' });
    const credits = await getCredits(new NextRequest('http://localhost/api/credits', { headers: { cookie: `sanboard_session=${token}` } }));
    assert.equal((await credits.json()).testPublishBypass, true);

    const response = await publishListing(request(testProfileId, testUserId, payload()));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.listing.status, 'ACTIVE');
    assert.equal(result.listing.seller_profile_id, testProfileId);
    assert.equal(db.credits.length, 0);
    assert.equal(new Date(result.listing.expires_at).getTime() - new Date(result.listing.published_at).getTime(), 7 * 86400000);
    assert.equal(db.auditLogs.at(-1)?.event_type, 'TEST_LISTING_PAYMENT_BYPASS');
    assert.equal(db.auditLogs.at(-1)?.metadata?.charged, false);
  });

  test('vehicle publish succeeds with three metadata-only image references', async () => {
    const response = await publishListing(request(testProfileId, testUserId, payload({ images: imageReferences(3) })));
    assert.equal(response.status, 200);
    const listing = (await response.json()).listing;
    assert.equal(listing.images.length, 3);
    assert.equal(listing.images.some((item: any) => item.storage_path.startsWith('data:')), false);
  });

  test('property publish succeeds with five metadata-only image references', async () => {
    const propertyPayload = {
      category: 'property', subcategory: 'Ev / Daire', title: 'Test mülkü', description: 'Beş görselli mülk', price: 250000,
      images: imageReferences(5), location: 'Rockford Hills', floor: 2, room_count: '2+1', room_number: 5, furnished: true,
      alarm: true, market_value: 225000, furniture_value: 15000, building_type: 'Normal', balcony: true,
    };
    const response = await publishListing(request(testProfileId, testUserId, propertyPayload));
    assert.equal(response.status, 200);
    const listing = (await response.json()).listing;
    assert.equal(listing.images.length, 5);
    assert.equal(listing.property_details.market_value, 225000);
    assert.equal(listing.property_details.room_number, 5);
    assert.equal(listing.property_details.alarm, true);
    assert.equal(listing.images.some((item: any) => item.storage_path.startsWith('data:')), false);

    const editResponse = await updateListing(
      updateRequest(testProfileId, testUserId, listing.id, { ...propertyPayload, room_number: 8, alarm: false }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    assert.equal(editResponse.status, 200);
    const updated = (await editResponse.json()).listing;
    assert.equal(updated.property_details.room_number, 8);
    assert.equal(updated.property_details.alarm, false);
  });

  test('character switching remains isolated to the signed active test character', async () => {
    const response = await publishListing(request(siblingProfileId, testUserId, payload()));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).listing.seller_profile_id, siblingProfileId);
  });

  test('normal name match, ADMIN role, and injected test flags cannot bypass payment', async () => {
    for (const [profileId, userId] of [[normalProfileId, normalUserId], [adminProfileId, adminUserId]]) {
      const response = await publishListing(request(profileId, userId, payload({ testPublishBypass: true, paymentMode: 'TEST_BYPASS' })));
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /ilan hakkınız|krediniz/);
    }
    assert.equal(db.listings.length, 0);
  });

  test('canonical test account requires normal listing payment when payment bypass is disabled', async () => {
    process.env.ENABLE_TEST_PAYMENT_BYPASS = 'false';
    const token = createSessionToken({ userId: testUserId, profileId: testProfileId, role: 'ADMIN' });
    const credits = await getCredits(new NextRequest('http://localhost/api/credits', { headers: { cookie: `sanboard_session=${token}` } }));
    assert.equal((await credits.json()).testPublishBypass, false);

    const response = await publishListing(request(testProfileId, testUserId, payload({ testPublishBypass: true, paymentMode: 'TEST_BYPASS' })));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /ilan hakkınız|krediniz/);
    assert.equal(db.listings.length, 0);
    assert.equal(db.auditLogs.length, 0);
  });

  test('corporate test publish preserves store authorization and existing 14-day corporate lifecycle', async () => {
    const unauthorized = await publishListing(request(testProfileId, testUserId, payload({ corporate: true, seller_type: 'CORPORATE' })));
    assert.equal(unauthorized.status, 403);

    db.dealers.push({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', profile_id: testProfileId, owner_profile_id: testProfileId,
      company_name: 'Fixture Motors', description: '', logo_url: '', banner_url: '', status: 'APPROVED',
      moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', subscription_expires_at: '2026-10-28T12:00:00.000Z',
      created_at: now, updated_at: now,
    } as any);
    const response = await publishListing(request(testProfileId, testUserId, payload({ corporate: true, seller_type: 'CORPORATE' })));
    assert.equal(response.status, 200);
    const listing = (await response.json()).listing;
    assert.equal(listing.seller_type, 'CORPORATE');
    assert.equal(listing.corporate_profile_id, db.dealers[0].id);
    assert.equal(new Date(listing.expires_at).getTime() - new Date(listing.published_at).getTime(), 14 * 86400000);
  });

  test('canonical test actor boosts an owned individual listing without payment', async () => {
    db.listings.push({ id: 'test-individual-listing', listing_number: '#TEST1', seller_profile_id: testProfileId, seller_type: 'INDIVIDUAL', corporate_profile_id: null, category: 'vehicle', subcategory: 'Otomobil', title: 'Test aracı', description: 'Test', price: 1000, status: 'ACTIVE', expires_at: '2026-10-12T12:00:00.000Z', created_at: now, updated_at: now } as any);
    const token = createSessionToken({ userId: testUserId, profileId: testProfileId, role: 'USER' });
    const before = Date.now();
    const response = await boostListing(new NextRequest('http://localhost/api/dealers/boost', {
      method: 'POST', headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ listingId: 'test-individual-listing', skipPayment: true }),
    }));
    assert.equal(response.status, 200);
    assert.equal(db.listings[0].is_featured, true);
    assert.ok(new Date(db.listings[0].featured_until!).getTime() >= before + 24 * 3600000);
    assert.equal(db.auditLogs.at(-1)?.event_type, 'TEST_FEATURED_PAYMENT_BYPASS');
    assert.equal(db.auditLogs.at(-1)?.metadata?.charged, false);
  });

  test('canonical test actor receives no free boost when payment bypass is disabled', async () => {
    process.env.ENABLE_TEST_PAYMENT_BYPASS = 'false';
    db.listings.push({ id: 'paid-boost-listing', listing_number: '#TEST3', seller_profile_id: testProfileId, seller_type: 'INDIVIDUAL', corporate_profile_id: null, category: 'vehicle', subcategory: 'Otomobil', title: 'Paid boost', description: 'Test', price: 1000, status: 'ACTIVE', expires_at: '2026-10-12T12:00:00.000Z', created_at: now, updated_at: now } as any);
    const token = createSessionToken({ userId: testUserId, profileId: testProfileId, role: 'USER' });
    const response = await boostListing(new NextRequest('http://localhost/api/dealers/boost', {
      method: 'POST', headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ listingId: 'paid-boost-listing', skipPayment: true, paymentMode: 'TEST_BYPASS' }),
    }));
    assert.notEqual(response.status, 200);
    assert.equal(db.listings[0].is_featured, undefined);
    assert.equal(db.auditLogs.some((event) => event.event_type === 'TEST_FEATURED_PAYMENT_BYPASS'), false);
  });

  test('canonical corporate actor boosts an authorized listing without consuming credit', async () => {
    db.dealers.push({ id: 'test-store', profile_id: testProfileId, owner_profile_id: testProfileId, company_name: 'Test Store', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', subscription_expires_at: '2026-12-31T00:00:00.000Z', boost_credits: 0, created_at: now, updated_at: now } as any);
    db.listings.push({ id: 'test-corporate-listing', listing_number: '#TEST2', seller_profile_id: testProfileId, seller_type: 'CORPORATE', corporate_profile_id: 'test-store', category: 'property', subcategory: 'Ev / Daire', title: 'Test mülkü', description: 'Test', price: 1000, status: 'ACTIVE', expires_at: '2026-10-12T12:00:00.000Z', created_at: now, updated_at: now } as any);
    const token = createSessionToken({ userId: testUserId, profileId: testProfileId, role: 'USER' });
    const response = await boostListing(new NextRequest('http://localhost/api/dealers/boost', {
      method: 'POST', headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ listingId: 'test-corporate-listing' }),
    }));
    assert.equal(response.status, 200);
    assert.equal(db.dealers[0].boost_credits, 0);
    assert.equal(db.listings[0].is_featured, true);
  });

  test('test actor cannot boost another listing and production actor cannot inject bypass flags', async () => {
    db.listings.push({ id: 'foreign-listing', listing_number: '#FOREIGN', seller_profile_id: normalProfileId, seller_type: 'INDIVIDUAL', corporate_profile_id: null, category: 'vehicle', subcategory: 'Otomobil', title: 'Foreign', description: 'Test', price: 1000, status: 'ACTIVE', expires_at: '2026-10-12T12:00:00.000Z', created_at: now, updated_at: now } as any);
    for (const [userId, profileId] of [[testUserId, testProfileId], [normalUserId, normalProfileId]]) {
      const token = createSessionToken({ userId, profileId, role: 'USER' });
      const response = await boostListing(new NextRequest('http://localhost/api/dealers/boost', {
        method: 'POST', headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ listingId: 'foreign-listing', skipPayment: true, paymentMode: 'TEST_BYPASS' }),
      }));
      assert.equal(response.status, 403);
    }
    assert.equal(db.listings[0].is_featured, undefined);
  });
});