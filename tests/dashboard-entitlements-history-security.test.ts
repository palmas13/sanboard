import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { GET as bootstrap } from '@/app/api/account/bootstrap/route';
import { DELETE as clearListingHistory, GET as getListings } from '@/app/api/user/listings/route';
import { createSessionToken } from '@/lib/auth/session';
import { db } from '@/lib/db/store';
import { getCreditPresentation } from '@/lib/dashboard/credit-presentation';
import { filterOwnerDashboardListings, getOwnerDashboardCounts } from '@/lib/listings/owner-dashboard';
import { getPublicListings, getUserListings } from '@/lib/db/listings';
import { formatTimeRemaining } from '@/lib/utils/format';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const accountA = '11111111-1111-4111-8111-111111111111';
const accountB = '22222222-2222-4222-8222-222222222222';
const profileA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const profileB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function request(path: string, profileId: string, userId = accountA, method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      cookie: `sanboard_session=${createSessionToken({ userId, profileId, role: 'USER' })}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('dashboard entitlements and listing-history security', () => {
  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'dashboard-entitlement-history-secret-32';
    db.users = [
      { id: accountA, provider: 'GTAWORLD', external_user_id: 'a', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: accountB, provider: 'GTAWORLD', external_user_id: 'b', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' },
    ];
    db.profiles = [
      { id: profileA, user_id: accountA, full_name: 'Alex', avatar_url: '', phone: '', sanmail_email: '', created_at: '', updated_at: '' },
      { id: profileB, user_id: accountB, full_name: 'Blair', avatar_url: '', phone: '', sanmail_email: '', created_at: '', updated_at: '' },
    ];
    db.dealers = [{ id: 'store-a', owner_profile_id: profileA, profile_id: profileA, company_name: 'Store A', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', boost_credits: 0, created_at: '', updated_at: '' } as any];
    db.credits = [
      { id: 'individual-a', profile_id: profileA, credit_type: 'INDIVIDUAL', status: 'AVAILABLE' },
      { id: 'corporate-a', profile_id: profileA, credit_type: 'CORPORATE', corporate_profile_id: 'store-a', status: 'AVAILABLE' },
      { id: 'wrong-store', profile_id: profileA, credit_type: 'CORPORATE', corporate_profile_id: 'store-b', status: 'AVAILABLE' },
      { id: 'individual-b', profile_id: profileB, credit_type: 'INDIVIDUAL', status: 'AVAILABLE' },
    ] as any;
    db.listings = [
      { id: 'active-a', seller_profile_id: profileA, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Active', description: '', price: 1, status: 'ACTIVE', expires_at: new Date(Date.now() + 86_400_000).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'expired-a', seller_profile_id: profileA, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Expired A', description: '', price: 1, status: 'EXPIRED', expires_at: '2026-01-02T00:00:00Z', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
      { id: 'expired-b', seller_profile_id: profileB, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Expired B', description: '', price: 1, status: 'EXPIRED', expires_at: '2026-01-02T00:00:00Z', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
    ] as any;
    db.soldAudits = [];
    db.favorites = [];
    db.tickets = [];
  });

  test('bootstrap separates individual rights from rights scoped to the owned store', async () => {
    const body = await (await bootstrap(request('/api/account/bootstrap', profileA))).json();
    assert.equal(body.credits.individualCredits, 1);
    assert.equal(body.credits.corporateCredits, 1);
    assert.equal(body.credits.availableCredits, 2);
  });

  test('bootstrap returns at most three nearest-expiry active personal listing summaries with cover only', async () => {
    const now = Date.now();
    db.listings.push(...[4, 2, 3, 1].map((days) => ({ id: `next-${days}`, public_id: `10000${days}`, seller_profile_id: profileA, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: `Next ${days}`, description: '', price: 1, status: 'ACTIVE', expires_at: new Date(now + days * 86_400_000).toISOString(), images: [{ id: `img-${days}`, listing_id: `next-${days}`, storage_path: `listings/${days}.webp`, sort_order: 0, is_cover: true, size_bytes: 1, created_at: '' }], created_at: '', updated_at: '' } as any)));
    const body = await (await bootstrap(request('/api/account/bootstrap', profileA))).json();
    assert.deepEqual(body.upcomingPersonalListings.map((item: any) => item.id), ['active-a', 'next-1', 'next-2']);
    assert.deepEqual(Object.keys(body.upcomingPersonalListings[1]).sort(), ['cover_image', 'expires_at', 'id', 'public_id', 'title']);
    assert.equal(body.upcomingPersonalListings[1].cover_image, 'listings/1.webp');
  });

  test('bootstrap hides corporate credits when canonical publishing eligibility is inactive without mutating credits', async () => {
    db.dealers[0].subscription_status = 'INACTIVE';
    const body = await (await bootstrap(request('/api/account/bootstrap', profileA))).json();
    assert.equal(body.credits.individualCredits, 1);
    assert.equal(body.credits.corporateCredits, 0);
    assert.equal(body.credits.availableCredits, 1);
    assert.equal(db.credits.find((credit) => credit.id === 'corporate-a')?.status, 'AVAILABLE');
  });

  test('overview entitlement messages distinguish individual, corporate and combined contexts', () => {
    assert.deepEqual(getCreditPresentation(2, 0), { total: 2, message: '2 bireysel ilan hakkınız var.', href: '/ilan-ver' });
    assert.deepEqual(getCreditPresentation(0, 3), { total: 3, message: '3 kurumsal ilan hakkınız var.', href: '/hesabim/kurumsal' });
    assert.deepEqual(getCreditPresentation(2, 3), { total: 5, message: '2 bireysel ve 3 kurumsal ilan hakkınız var.', href: '/ilan-ver' });
    assert.deepEqual(getCreditPresentation(0, 0), { total: 0, message: '0 bireysel ilan hakkınız var.', href: '/ilan-ver' });
  });

  test('history clear rejects active status and only hides the actor selected history', async () => {
    assert.equal((await clearListingHistory(request('/api/user/listings', profileA, accountA, 'DELETE', { status: 'ACTIVE' }))).status, 400);
    const cleared = await clearListingHistory(request('/api/user/listings', profileA, accountA, 'DELETE', { status: 'EXPIRED' }));
    assert.equal(cleared.status, 200);
    assert.deepEqual((await (await getListings(request('/api/user/listings', profileA))).json()).map((item: any) => item.id), ['active-a']);
    assert.deepEqual((await (await getListings(request('/api/user/listings', profileB, accountB))).json()).map((item: any) => item.id), ['expired-b']);
    assert.ok(db.listings.some((item) => item.id === 'expired-a'), 'soft clear must retain source rows');
  });

  test('overview exact copy and character header button removals remain enforced', () => {
    const overview = source('src/app/hesabim/page.tsx');
    const layout = source('src/app/hesabim/layout.tsx');
    assert.match(overview, /Merhaba, \{firstName\} 👋/);
    assert.match(overview, /İlan Hakların/);
    assert.match(overview, /loading \? <div className="mt-3 h-\[72px\] animate-pulse/);
    assert.doesNotMatch(overview, /credits\.total/);
    assert.match(overview, /Bireysel ilan hakkı/);
    assert.match(overview, /data\.corporateCredits > 0/);
    assert.match(overview, /Kurumsal ilan hakkı/);
    assert.match(overview, /Yaklaşan Durumlar/);
    assert.match(overview, /upcomingPersonalListings/);
    assert.doesNotMatch(overview, /Süresi Dolan İlanlarım|İlan Hakkı=/);
    assert.doesNotMatch(layout, /Mağazamı Aç|Yeni İlan Ver/);
  });

  test('personal dashboard filters active, expired and sold rows with accurate full-dataset counts', () => {
    const listings = [
      ...db.listings,
      { id: 'sold-a', listing_number: '#SOLD-A', seller_profile_id: profileA, seller_type: 'INDIVIDUAL', category: 'property', subcategory: 'Ev / Daire', title: 'Vinewood Satılık Ev', description: '', price: 3, status: 'SOLD', closed_at: new Date().toISOString(), created_at: '', updated_at: '' },
    ] as any;
    assert.deepEqual(getOwnerDashboardCounts(listings), { ACTIVE: 1, EXPIRED: 2, SOLD: 1 });
    assert.deepEqual(filterOwnerDashboardListings(listings, { status: 'ACTIVE', type: 'ALL', query: '' }).map((item) => item.id), ['active-a']);
    assert.deepEqual(filterOwnerDashboardListings(listings, { status: 'EXPIRED', type: 'vehicle', query: 'Expired A' }).map((item) => item.id), ['expired-a']);
    assert.deepEqual(filterOwnerDashboardListings(listings, { status: 'SOLD', type: 'property', query: 'Vinewood' }).map((item) => item.id), ['sold-a']);
    assert.deepEqual(filterOwnerDashboardListings(listings, { status: 'EXPIRED', type: 'property', query: '' }), []);
  });

  test('ACTIVE to EXPIRED transition moves the same personal listing between owner tabs while public retrieval stays hidden', async () => {
    const listing = db.listings.find((item) => item.id === 'active-a')!;
    assert.deepEqual(filterOwnerDashboardListings(await getUserListings(profileA), { status: 'ACTIVE', type: 'ALL', query: '' }).map((item) => item.id), ['active-a']);
    assert.deepEqual(filterOwnerDashboardListings(await getUserListings(profileA), { status: 'EXPIRED', type: 'ALL', query: '' }).map((item) => item.id), ['expired-a']);

    listing.status = 'EXPIRED';
    listing.expires_at = new Date(Date.now() - 60_000).toISOString();
    const after = await getUserListings(profileA);
    assert.deepEqual(filterOwnerDashboardListings(after, { status: 'ACTIVE', type: 'ALL', query: '' }), []);
    assert.deepEqual(filterOwnerDashboardListings(after, { status: 'EXPIRED', type: 'ALL', query: '' }).map((item) => item.id).sort(), ['active-a', 'expired-a']);
    assert.equal(getOwnerDashboardCounts(after).EXPIRED, 2);
    assert.equal(after.find((item) => item.id === 'active-a')?.seller_profile_id, profileA);
    assert.equal((await getPublicListings()).some((item) => item.id === 'active-a'), false);
    assert.equal(formatTimeRemaining(listing.expires_at).text, 'Süresi Doldu');
  });

  test('expired owner visibility lasts until purge removes the row and remains isolated from siblings and corporate inventory', async () => {
    db.listings.push(
      { id: 'recent-expired-a', listing_number: '#RECENT', seller_profile_id: profileA, seller_type: 'INDIVIDUAL', category: 'property', subcategory: 'Ev / Daire', title: 'Mirror Park House', description: '', price: 2, location: 'Mirror Park', status: 'EXPIRED', expires_at: new Date(Date.now() - 6 * 86_400_000).toISOString(), created_at: '', updated_at: '' },
      { id: 'corporate-expired-a', listing_number: '#CORP', seller_profile_id: profileA, seller_type: 'CORPORATE', corporate_profile_id: 'store-a', category: 'vehicle', subcategory: 'Otomobil', title: 'Corporate Expired', description: '', price: 2, location: null, status: 'EXPIRED', expires_at: new Date(Date.now() - 60_000).toISOString(), created_at: '', updated_at: '' },
    );
    const ownerRows = await getUserListings(profileA);
    assert.ok(ownerRows.some((item) => item.id === 'recent-expired-a'));
    assert.equal(ownerRows.some((item) => item.id === 'expired-b'), false);
    assert.equal(ownerRows.some((item) => item.id === 'corporate-expired-a'), false);
    assert.deepEqual(filterOwnerDashboardListings(ownerRows, { status: 'EXPIRED', type: 'property', query: 'Mirror Park' }).map((item) => item.id), ['recent-expired-a']);

    db.listings = db.listings.filter((item) => item.id !== 'recent-expired-a');
    assert.equal((await getUserListings(profileA)).some((item) => item.id === 'recent-expired-a'), false);
  });

  test('personal dashboard source keeps compact cards, cover-only images and existing management actions', () => {
    const page = source('src/app/hesabim/ilanlarim/page.tsx');
    const repository = source('src/lib/db/repositories/supabase/supabase-listing-repo.ts');
    const ownerMethod = repository.slice(repository.indexOf('async getUserListings'), repository.indexOf('async clearUserListingHistory'));
    assert.match(page, /getListingCoverPath\(listing\.images\)/);
    assert.match(page, /<Image[\s\S]*sizes=/);
    assert.match(page, /İlanı Gör/);
    assert.match(page, />Düzenle</);
    assert.match(page, /İlanı Kapat/);
    assert.match(page, /İlanı hangi nedenle kapatmak istiyorsun/);
    assert.match(page, /role="menu"/);
    assert.match(page, /event\.key !== 'Escape'/);
    assert.match(page, /Bu filtreye uygun ilan bulunamadı/);
    assert.doesNotMatch(page, /<img/);
    assert.match(ownerMethod, /const client = this\.getAdminClient\(\)/);
    assert.match(ownerMethod, /\.eq\('seller_profile_id', safeProfileId\)[\s\S]*\.eq\('seller_type', 'INDIVIDUAL'\)[\s\S]*\.is\('corporate_profile_id', null\)/);
  });
});