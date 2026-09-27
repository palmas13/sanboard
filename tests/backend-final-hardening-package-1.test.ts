import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { db } from '@/lib/db/store';
import { GET as getDealerProfile } from '@/app/api/dealers/profile/route';
import { GET as getDealerListings } from '@/app/api/dealers/listings/route';
import { GET as getBootstrap } from '@/app/api/account/bootstrap/route';
import { POST as reportListing } from '@/app/api/reports/route';
import { GET as getFavorites } from '@/app/api/user/favorites/route';
import { GET as getUserListings } from '@/app/api/user/listings/route';
import { POST as saveProfileOnboarding } from '@/app/api/user/profile/route';
import { GET as getOwnListing, PUT as updateOwnListing, DELETE as deleteOwnListing } from '@/app/api/user/listings/[id]/route';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('SANBOARD backend final hardening package 1', () => {
  const accountX = '11111111-1111-4111-8111-111111111111';
  const accountY = '22222222-2222-4222-8222-222222222222';
  const alex = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const jordan = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const morgan = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  function request(path: string, profileId?: string, body?: unknown) {
    const cookies = profileId
      ? `sanboard_session=${createSessionToken({ userId: profileId === morgan ? accountY : accountX, profileId, role: 'USER' })}; sanboard_profile_id=${jordan}; sanboard_user_id=${accountY}; sanboard_role=ADMIN`
      : `sanboard_profile_id=${jordan}; sanboard_user_id=${accountY}; sanboard_role=ADMIN`;
    return new NextRequest(`http://localhost${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { cookie: cookies, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'backend-final-hardening-package-1-secret';
    db.users = [
      { id: accountX, provider: 'GTAWORLD', external_user_id: 'x', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: accountY, provider: 'GTAWORLD', external_user_id: 'y', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' },
    ];
    db.profiles = [
      { id: alex, user_id: accountX, full_name: 'Alex Stone', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' },
      { id: jordan, user_id: accountX, full_name: 'Jordan Reed', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' },
      { id: morgan, user_id: accountY, full_name: 'Morgan Hale', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' },
    ];
    db.dealers = [
      { id: 'store-alex', profile_id: alex, owner_profile_id: alex, company_name: 'Alex Store', slug: 'alex', description: '', logo_url: '', banner_url: '', status: 'APPROVED', subscription_status: 'ACTIVE', moderation_status: 'ACTIVE', boost_credits: 0, created_at: '', updated_at: '' },
      { id: 'store-jordan', profile_id: jordan, owner_profile_id: jordan, company_name: 'Jordan Store', slug: 'jordan', description: '', logo_url: '', banner_url: '', status: 'APPROVED', subscription_status: 'ACTIVE', moderation_status: 'ACTIVE', boost_credits: 0, created_at: '', updated_at: '' },
    ];
    db.listings = [
      { id: 'listing-alex', listing_number: '#A', seller_profile_id: alex, corporate_profile_id: 'store-alex', seller_type: 'CORPORATE', category: 'vehicle', subcategory: 'Otomobil', title: 'Alex', description: '', price: 1, location: '', status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: 'listing-jordan', listing_number: '#J', seller_profile_id: jordan, corporate_profile_id: 'store-jordan', seller_type: 'CORPORATE', category: 'vehicle', subcategory: 'Otomobil', title: 'Jordan', description: '', price: 1, location: '', status: 'ACTIVE', created_at: '', updated_at: '' },
    ];
    db.favorites = [];
    db.credits = [];
    db.tickets = [{ id: 'ticket-jordan', profile_id: jordan, subject: 'Sibling', status: 'OPEN', creator_name: 'Jordan', created_at: '', updated_at: '', messages: [] }];
    db.reports = [];
  });

  test('corporate dashboard ignores query and legacy cookie actor injection', async () => {
    const profile = await getDealerProfile(request(`/api/dealers/profile?profileId=${jordan}`, alex));
    assert.equal((await profile.json()).dealer.id, 'store-alex');
    const listings = await getDealerListings(request(`/api/dealers/listings?profileId=${jordan}`, alex));
    assert.deepEqual((await listings.json()).listings.map((item: any) => item.id), ['listing-alex']);
    const timing = listings.headers.get('server-timing') || '';
    for (const metric of ['auth', 'dealer', 'db', 'enrich', 'serialize', 'total']) {
      assert.match(timing, new RegExp(`(?:^|, )${metric};dur=\\d+\\.\\d`));
    }
    assert.equal((await getDealerProfile(request('/api/dealers/profile'))).status, 401);
  });

  test('dealer listings errors retain completed Server-Timing metrics and total', async () => {
    const response = await getDealerListings(request('/api/dealers/listings', undefined));
    assert.equal(response.status, 401);
    const timing = response.headers.get('server-timing') || '';
    assert.match(timing, /auth;dur=\d+\.\d/);
    assert.match(timing, /total;dur=\d+\.\d/);
    assert.doesNotMatch(timing, /dealer;dur=/);
    assert.doesNotMatch(timing, /db;dur=/);
    assert.doesNotMatch(timing, /enrich;dur=/);
  });

  test('user listings exposes real sub-stage timings without changing the response body', async () => {
    db.listings.push({ id: 'personal-alex-active', listing_number: '#PA', seller_profile_id: alex, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Personal Active', description: '', price: 1, location: '', status: 'ACTIVE', created_at: '', updated_at: '' });

    const response = await getUserListings(request('/api/user/listings', alex));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map((item: any) => item.id), ['personal-alex-active']);

    const timing = response.headers.get('server-timing') || '';
    for (const metric of ['actor', 'listings_query', 'listings_serialize', 'listings', 'total']) {
      assert.match(timing, new RegExp(`(?:^|, )${metric};dur=\\d+\\.\\d`));
    }
    assert.doesNotMatch(timing, /listings_enrich;dur=/);
    assert.doesNotMatch(timing, /listings_map;dur=/);
    assert.doesNotMatch(timing, /price_history_query;dur=/);
    assert.doesNotMatch(timing, /favorites_query;dur=/);
    assert.doesNotMatch(timing, /enrich_map;dur=/);
  });

  test('Supabase user-listing enrichment keeps parallel queries and reports only real sub-stages', () => {
    const repository = readFileSync(join(process.cwd(), 'src/lib/db/repositories/supabase/supabase-listing-repo.ts'), 'utf8');
    assert.match(repository, /Promise\.all\(\[\s*\(async \(\) => \{[\s\S]*?'price_history_query'[\s\S]*?\}\)\(\),\s*\(async \(\) => \{[\s\S]*?'favorites_query'[\s\S]*?\}\)\(\),\s*\]\)/);
    assert.match(repository, /const enrichMapStartedAt = performance\.now\(\);[\s\S]*?onTiming\?\.\('enrich_map', performance\.now\(\) - enrichMapStartedAt\)/);
    assert.doesNotMatch(repository, /onTiming\?\.\('(price_history_query|favorites_query|enrich_map)', 0\)/);
  });

  test('account bootstrap is active-character scoped, not sibling-account aggregated', async () => {
    db.listings.push(
      { id: 'personal-alex-active', listing_number: '#PA', seller_profile_id: alex, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Personal Active', description: '', price: 1, location: '', status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: 'personal-alex-expired', listing_number: '#PE', seller_profile_id: alex, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Personal Expired', description: '', price: 1, location: '', status: 'EXPIRED', created_at: '', updated_at: '' },
      { id: 'personal-jordan-active', listing_number: '#PJ', seller_profile_id: jordan, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Sibling Personal', description: '', price: 1, location: '', status: 'ACTIVE', created_at: '', updated_at: '' },
    );
    db.favorites = [
      { id: 'alex-given', profile_id: alex, listing_id: 'listing-jordan', created_at: '' },
      { id: 'received-one', profile_id: jordan, listing_id: 'personal-alex-active', created_at: '' },
      { id: 'received-sibling', profile_id: alex, listing_id: 'personal-jordan-active', created_at: '' },
    ];
    db.credits = [{ id: 'credit-alex', profile_id: alex, status: 'AVAILABLE', created_at: '', updated_at: '' } as any];
    db.tickets.push({ id: 'ticket-alex', profile_id: alex, subject: 'Own', status: 'OPEN', creator_name: 'Alex', created_at: '', updated_at: '', messages: [] });
    const response = await getBootstrap(request('/api/account/bootstrap', alex));
    const body = await response.json();
    assert.equal(body.profile.id, alex);
    assert.equal(body.stats.activeListings, 1);
    assert.equal(body.stats.expiredListings, 1);
    assert.equal(body.stats.favoritesCount, 2);
    assert.equal(body.stats.favorites, 2);
    assert.equal(body.stats.totalReceivedFavorites, 1);
    assert.equal(body.credits.availableCredits, 1);
    assert.equal(body.corporate.dealerProfile.id, 'store-alex');
    assert.equal(body.support.openTickets, 1);
    assert.equal((await getBootstrap(request('/api/account/bootstrap'))).status, 401);
  });

  test('favorites are active-character scoped despite query and legacy cookie injection', async () => {
    db.favorites = [
      { id: 'favorite-alex', profile_id: alex, listing_id: 'listing-alex', created_at: '' },
      { id: 'favorite-jordan', profile_id: jordan, listing_id: 'listing-jordan', created_at: '' },
    ];
    const response = await getFavorites(request(`/api/user/favorites?profileId=${jordan}`, alex));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map((item: { id: string }) => item.id), ['listing-alex']);
    assert.equal((await getFavorites(request('/api/user/favorites'))).status, 401);
  });

  test('private listing detail, update and delete reject a sibling character owner', async () => {
    const context = { params: Promise.resolve({ id: 'listing-jordan' }) };
    assert.equal((await getOwnListing(request('/api/user/listings/listing-jordan', alex), context)).status, 403);
    assert.equal((await updateOwnListing(request('/api/user/listings/listing-jordan', alex, {
      profileId: jordan,
      sellerProfileId: jordan,
      title: 'Sibling attack',
    }), context)).status, 403);
    assert.equal((await deleteOwnListing(request('/api/user/listings/listing-jordan', alex), context)).status, 403);
    assert.equal(db.listings.find((listing) => listing.id === 'listing-jordan')?.status, 'ACTIVE');
  });

  test('profile onboarding ignores client external identity and updates only the signed active profile', async () => {
    const response = await saveProfileOnboarding(request('/api/user/profile', alex, {
      characterId: 'attacker-external-character',
      fullName: 'Injected Name',
      sanmailEmail: 'alex@sanmail.com',
      phone: '1001',
    }));
    assert.equal(response.status, 200);
    assert.equal(db.profiles.find((profile) => profile.id === alex)?.full_name, 'Alex Stone');
    assert.equal(db.profiles.find((profile) => profile.id === alex)?.external_character_id, undefined);
    assert.equal(db.profiles.find((profile) => profile.id === alex)?.sanmail_email, 'alex@sanmail.com');
    assert.equal(db.profiles.find((profile) => profile.id === jordan)?.sanmail_email, '');
    assert.equal((await saveProfileOnboarding(request('/api/user/profile', undefined, {
      characterId: 'attacker-external-character',
      fullName: 'Injected Name',
    }))).status, 401);
  });

  test('reporter actor is signed active character despite body and cookie injection', async () => {
    const response = await reportListing(request('/api/reports', alex, { reporterProfileId: jordan, listingId: 'listing-jordan', reason: 'Diğer' }));
    assert.equal(response.status, 200);
    assert.equal(db.reports[0].reporter_profile_id, alex);
    assert.equal((await reportListing(request('/api/reports', undefined, { reporterProfileId: jordan, listingId: 'listing-jordan', reason: 'Diğer' }))).status, 401);
  });

  test('legacy actor cookies are not read by normal-user private routes', () => {
    const routeFiles = [
      'src/app/api/account/bootstrap/route.ts',
      'src/app/api/dealers/listings/route.ts',
      'src/app/api/dealers/profile/route.ts',
      'src/app/api/dealers/subscription/activate/route.ts',
      'src/app/api/reports/route.ts',
      'src/app/api/user/favorites/route.ts',
      'src/app/api/user/listings/[id]/route.ts',
      'src/app/api/user/profile/route.ts',
    ];
    for (const file of routeFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      assert.doesNotMatch(source, /sanboard_(?:profile_id|user_id|role)/, file);
      assert.match(source, /resolveOwnedActiveProfile/, file);
    }
  });

  test('listing credit publication is atomic-only and legacy consumeCredit is removed', () => {
    const listingRepo = readFileSync(join(process.cwd(), 'src/lib/db/repositories/supabase/supabase-listing-repo.ts'), 'utf8');
    const paymentTypes = readFileSync(join(process.cwd(), 'src/lib/db/repositories/types.ts'), 'utf8');
    const memoryPayments = readFileSync(join(process.cwd(), 'src/lib/db/repositories/memory/memory-payment-repo.ts'), 'utf8');
    const supabasePayments = readFileSync(join(process.cwd(), 'src/lib/db/repositories/supabase/supabase-payment-repo.ts'), 'utf8');
    const createStart = listingRepo.indexOf("client.rpc('create_listing_with_credit'");
    const createEnd = listingRepo.indexOf('async republishListing', createStart);
    const createSource = listingRepo.slice(createStart, createEnd);
    assert.ok(createStart >= 0 && createEnd > createStart);
    assert.match(createSource, /Atomik ilan oluşturma işlemi kullanılamıyor/);
    assert.doesNotMatch(createSource, /from\('listings'\)\.insert|from\('listing_credits'\)\.update/);
    assert.doesNotMatch(paymentTypes, /consumeCredit/);
    assert.doesNotMatch(memoryPayments, /consumeCredit/);
    assert.doesNotMatch(supabasePayments, /consumeCredit/);
  });
});