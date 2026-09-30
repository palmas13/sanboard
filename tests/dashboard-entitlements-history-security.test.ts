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

  test('overview entitlement messages distinguish individual, corporate and combined contexts', () => {
    assert.deepEqual(getCreditPresentation(2, 0), { total: 2, message: '2 bireysel ilan hakkınız var.', href: '/ilan-ver' });
    assert.deepEqual(getCreditPresentation(0, 3), { total: 3, message: '3 kurumsal ilan hakkınız var.', href: '/hesabim/kurumsal' });
    assert.deepEqual(getCreditPresentation(2, 3), { total: 5, message: '2 bireysel ve 3 kurumsal ilan hakkınız var.', href: '/ilan-ver' });
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
    assert.match(overview, /Bireysel ilanlarını görüntüle, düzenle ve durumunu kontrol et\./);
    assert.match(overview, /İlan Hakkı=/);
    assert.doesNotMatch(layout, /Mağazamı Aç|Yeni İlan Ver/);
  });
});