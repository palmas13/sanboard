import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { POST as createListing } from '@/app/api/listings/route';
import { PUT as updateListing } from '@/app/api/user/listings/[id]/route';
import { listingUnionSchema, LISTING_TITLE_MAX_ERROR } from '@/lib/validations/listing';

describe('listing title 40 character limit', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const profileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const now = new Date('2026-09-29T12:00:00.000Z').toISOString();

  const vehicle = (title: string, extra: Record<string, unknown> = {}) => ({
    category: 'vehicle', subcategory: 'Otomobil', title, description: 'Test', price: 1000,
    images: [{ storage_path: '/test.jpg', sort_order: 0, is_cover: true, size_bytes: 100 }],
    brand: 'Dinka', model: 'Blista', plate: 'TITLE40', mileage: 10,
    engine_upgrade: 0, transmission_upgrade: 0, brake_upgrade: 0,
    turbo: false, subwoofer: false, trade_available: false, ...extra,
  });
  const property = (title: string) => ({
    category: 'property', subcategory: 'Ev / Daire', title, description: 'Test', price: 1000,
    images: [{ storage_path: '/test.jpg', sort_order: 0, is_cover: true, size_bytes: 100 }],
    location: 'Vinewood', floor: 1, room_count: '1+1', furnished: false, building_type: 'Normal', balcony: false,
  });

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.ENABLE_TEST_LOGIN = 'false';
    process.env.SANBOARD_SESSION_SECRET = 'listing-title-limit-secret-32-chars';
    db.users = [{ id: userId, provider: 'GTAWORLD', external_user_id: 'real-account', role: 'USER', status: 'ACTIVE', created_at: now, updated_at: now }] as any;
    db.profiles = [{ id: profileId, user_id: userId, external_character_id: 'real-character', full_name: 'Owner', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: now, updated_at: now }] as any;
    db.listings = [];
    db.dealers = [];
    db.credits = [];
    db.auditLogs = [];
  });

  const request = (url: string, body: unknown, method = 'POST') => {
    const token = createSessionToken({ userId, profileId, role: 'USER' });
    return new NextRequest(url, { method, headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  };

  test('vehicle, property and corporate schemas accept 40 and reject 41', () => {
    for (const payload of [vehicle('A'.repeat(40)), property('A'.repeat(40)), vehicle('A'.repeat(40), { seller_type: 'CORPORATE', corporate_profile_id: 'store' })]) {
      assert.equal(listingUnionSchema.safeParse(payload).success, true);
    }
    for (const payload of [vehicle('A'.repeat(41)), property('A'.repeat(41)), vehicle('A'.repeat(41), { seller_type: 'CORPORATE', corporate_profile_id: 'store' })]) {
      const result = listingUnionSchema.safeParse(payload);
      assert.equal(result.success, false);
      assert.equal(result.error?.issues[0]?.message, LISTING_TITLE_MAX_ERROR);
    }
  });

  test('direct create API rejects 41 characters before payment guard', async () => {
    const response = await createListing(request('http://localhost/api/listings', vehicle('A'.repeat(41))));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, LISTING_TITLE_MAX_ERROR);
  });

  test('edit API rejects restored legacy title over 40 without silently truncating', async () => {
    db.listings.push({ id: 'listing-title', listing_number: '#TITLE', seller_profile_id: profileId, seller_type: 'INDIVIDUAL', corporate_profile_id: null, ...vehicle('Legacy title'), status: 'ACTIVE', created_at: now, updated_at: now } as any);
    const response = await updateListing(
      request('http://localhost/api/user/listings/listing-title', vehicle('A'.repeat(41)), 'PUT'),
      { params: Promise.resolve({ id: 'listing-title' }) }
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, LISTING_TITLE_MAX_ERROR);
    assert.equal(db.listings[0].title, 'Legacy title');
  });
});