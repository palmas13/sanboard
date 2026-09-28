import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { GET as getCredits } from '@/app/api/credits/route';
import { POST as publishListing } from '@/app/api/listings/route';
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
});