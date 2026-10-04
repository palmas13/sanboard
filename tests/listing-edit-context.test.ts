import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { GET, PUT } from '@/app/api/user/listings/[id]/route';
import { LISTING_DESCRIPTION_MAX_ERROR } from '@/lib/validations/listing';

const accountId = '11111111-1111-4111-8111-111111111111';
const profileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const storeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now = '2026-09-29T12:00:00.000Z';

function request(method: 'GET' | 'PUT', body?: unknown) {
  const token = createSessionToken({ userId: accountId, role: 'USER', profileId });
  return new NextRequest('http://localhost/api/user/listings/corporate-listing', {
    method,
    headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('listing edit ownership and validation context', () => {
  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'listing-edit-context-secret-2026-safe';
    db.users = [{ id: accountId, provider: 'GTAWORLD', external_user_id: 'account', role: 'USER', status: 'ACTIVE', created_at: now, updated_at: now }] as any;
    db.profiles = [{ id: profileId, user_id: accountId, full_name: 'Store Owner', created_at: now, updated_at: now }] as any;
    db.dealers = [{ id: storeId, owner_profile_id: profileId, profile_id: profileId, company_name: 'Store', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', created_at: now, updated_at: now }] as any;
    db.listings = [{
      id: 'corporate-listing', listing_number: '#CORP', seller_profile_id: 'legacy-seller-profile', corporate_profile_id: storeId,
      seller_type: 'CORPORATE', category: 'vehicle', subcategory: 'Otomobil', title: 'Kurumsal Araç', description: 'Temiz araç', price: 1000,
      offers_enabled: true, minimum_offer_amount: null, location: null, status: 'ACTIVE', expires_at: '2026-10-10T12:00:00.000Z',
      images: [{ id: 'image-1', listing_id: 'corporate-listing', storage_path: 'listing/test.webp', sort_order: 0, is_cover: true, size_bytes: 100 }],
      vehicle_details: { listing_id: 'corporate-listing', vehicle_category: 'Otomobil', brand: 'Annis', model: 'Elegy Retro', plate: 'LS 123', mileage: 100, engine_upgrade: 0, transmission_upgrade: 0, brake_upgrade: 0, turbo: false, subwoofer: false, trade_available: false },
      created_at: now, updated_at: now,
    }] as any;
    db.favorites = [];
  });

  test('corporate store owner can load and update the shared edit form', async () => {
    const getResponse = await GET(request('GET'), { params: Promise.resolve({ id: 'corporate-listing' }) });
    assert.equal(getResponse.status, 200);
    const putResponse = await PUT(request('PUT', {
      category: 'vehicle', subcategory: 'Otomobil', title: 'Güncel Kurumsal Araç', description: 'Temiz araç', price: 1200,
      offers_enabled: true, minimum_offer_amount: null, images: db.listings[0].images,
      brand: 'Annis', model: 'Elegy Retro', plate: 'LS 123', mileage: 100, engine_upgrade: 0, transmission_upgrade: 0,
      brake_upgrade: 0, turbo: false, subwoofer: false, trade_available: false,
    }), { params: Promise.resolve({ id: 'corporate-listing' }) });
    assert.equal(putResponse.status, 200);
    assert.equal(db.listings[0].title, 'Güncel Kurumsal Araç');
  });

  test('edit API rejects a vehicle level above the canonical maximum', async () => {
    const response = await PUT(request('PUT', {
      category: 'vehicle', subcategory: 'Otomobil', title: 'Kurumsal Araç', description: 'Temiz araç', price: 1000,
      offers_enabled: true, minimum_offer_amount: null, images: db.listings[0].images,
      brand: 'Annis', model: 'Elegy Retro', plate: 'LS 123', mileage: 100, engine_upgrade: 4, transmission_upgrade: 4,
      brake_upgrade: 3, turbo: false, subwoofer: false, trade_available: false,
    }), { params: Promise.resolve({ id: 'corporate-listing' }) });
    assert.equal(response.status, 400);
    assert.equal(db.listings[0].vehicle_details?.transmission_upgrade, 0);
  });

  test('corporate edit API accepts 240 and rejects 241 description characters', async () => {
    const payload = {
      category: 'vehicle', subcategory: 'Otomobil', title: 'Kurumsal Araç', price: 1000,
      offers_enabled: true, minimum_offer_amount: null, images: db.listings[0].images,
      brand: 'Annis', model: 'Elegy Retro', plate: 'LS 123', mileage: 100,
      engine_upgrade: 0, transmission_upgrade: 0, brake_upgrade: 0,
      turbo: false, subwoofer: false, trade_available: false,
    };

    const validResponse = await PUT(request('PUT', {
      ...payload,
      description: 'A'.repeat(240),
    }), { params: Promise.resolve({ id: 'corporate-listing' }) });
    assert.equal(validResponse.status, 200);
    assert.equal(db.listings[0].description.length, 240);

    const invalidResponse = await PUT(request('PUT', {
      ...payload,
      description: 'A'.repeat(241),
    }), { params: Promise.resolve({ id: 'corporate-listing' }) });
    assert.equal(invalidResponse.status, 400);
    assert.equal((await invalidResponse.json()).error, LISTING_DESCRIPTION_MAX_ERROR);
    assert.equal(db.listings[0].description.length, 240);
  });
});