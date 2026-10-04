import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { resolveCorporateEligibility } from '@/lib/dealers/eligibility';
import { buildListingPackageOptions, resolveListingPackagePageState } from '@/lib/listings/package-options';
import { GET as getPackageOptions } from '@/app/api/listing-package-options/route';
import { POST as checkout } from '@/app/api/checkout/route';

describe('listing package options and entitlement-first UX', () => {
  const accountId = 'package-account';
  const profileId = 'package-profile';
  const storeId = 'package-store';
  const now = '2026-10-02T12:00:00.000Z';
  const profile = { id: profileId, user_id: accountId, full_name: 'Mavis Reed', avatar_url: '', sanmail_email: 'mavis@test', phone: '100', created_at: now, updated_at: now } as any;
  const activeDealer = () => ({ id: storeId, profile_id: profileId, owner_profile_id: profileId, company_name: 'Vinewood Motors', description: '', logo_url: '', banner_url: '', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', subscription_expires_at: '2026-11-02T12:00:00.000Z', created_at: now, updated_at: now } as any);

  function request(path: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
    const token = createSessionToken({ userId: accountId, profileId, role: 'USER' });
    return new NextRequest(`http://localhost${path}`, { ...init, headers: { cookie: `sanboard_session=${token}`, ...(init?.headers || {}) } });
  }

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'listing-package-options-secret-32-bytes-minimum';
    delete process.env.ENABLE_TEST_LOGIN;
    db.users = [{ id: accountId, provider: 'GTAWORLD', role: 'USER', status: 'ACTIVE', created_at: now, updated_at: now }] as any;
    db.profiles = [profile]; db.dealers = []; db.applications = []; db.credits = []; db.payments = [];
    db.packages = [
      { id: 'pkg-individual', code: 'STANDARD_7_DAY', name: '7 Günlük Bireysel', price: 1, duration_days: 7, active: true, seller_type: 'INDIVIDUAL' },
      { id: 'pkg-corporate', code: 'CORPORATE_14_DAY', name: '14 Günlük Kurumsal', price: 1, duration_days: 14, active: true, seller_type: 'CORPORATE' },
    ] as any;
  });

  test('no store, inactive membership and expired membership hide the corporate card', async () => {
    let result = buildListingPackageOptions({ profile, eligibility: await resolveCorporateEligibility(profileId), credits: [] });
    assert.equal(result.corporate, null);
    db.dealers = [activeDealer()]; db.dealers[0].subscription_status = 'INACTIVE'; db.dealers[0].subscription_expires_at = null;
    result = buildListingPackageOptions({ profile, eligibility: await resolveCorporateEligibility(profileId), credits: [] });
    assert.equal(result.corporate, null);
    db.dealers[0] = activeDealer(); db.dealers[0].subscription_status = 'EXPIRED'; db.dealers[0].subscription_expires_at = '2026-09-01T00:00:00.000Z';
    result = buildListingPackageOptions({ profile, eligibility: await resolveCorporateEligibility(profileId), credits: [] });
    assert.equal(result.corporate, null);
  });

  test('active corporate membership is visible and zero credit selects BUY', async () => {
    db.dealers = [activeDealer()];
    const result = buildListingPackageOptions({ profile, eligibility: await resolveCorporateEligibility(profileId), credits: [] });
    assert.equal(result.corporate?.dealer.id, storeId); assert.equal(result.corporate?.action, 'BUY'); assert.equal(result.individual.action, 'BUY');
  });

  test('available individual and store-scoped corporate credits select USE', async () => {
    db.dealers = [activeDealer()];
    const credits = [{ status: 'AVAILABLE', credit_type: 'INDIVIDUAL' }, { status: 'AVAILABLE', credit_type: 'CORPORATE', corporate_profile_id: storeId }, { status: 'AVAILABLE', credit_type: 'CORPORATE', corporate_profile_id: 'other-store' }];
    const result = buildListingPackageOptions({ profile, eligibility: await resolveCorporateEligibility(profileId), credits });
    assert.equal(result.individual.availableCredits, 1); assert.equal(result.individual.action, 'USE'); assert.equal(result.corporate?.availableCredits, 1); assert.equal(result.corporate?.action, 'USE');
  });

  test('page state gates unresolved and failed lookups without a personal fallback', () => {
    assert.deepEqual(resolveListingPackagePageState({ loading: true, options: null }), { status: 'LOADING' });
    assert.deepEqual(resolveListingPackagePageState({ loading: false, error: 'lookup failed', options: null }), { status: 'ERROR', message: 'lookup failed' });
  });

  test('mixed and dual entitlement states remain explicit multi-option selections', async () => {
    db.dealers = [activeDealer()];
    const individualUse = buildListingPackageOptions({ profile, eligibility: await resolveCorporateEligibility(profileId), credits: [{ status: 'AVAILABLE', credit_type: 'INDIVIDUAL' }] });
    const corporateUse = buildListingPackageOptions({ profile, eligibility: await resolveCorporateEligibility(profileId), credits: [{ status: 'AVAILABLE', credit_type: 'CORPORATE', corporate_profile_id: storeId }] });
    const bothUse = buildListingPackageOptions({ profile, eligibility: await resolveCorporateEligibility(profileId), credits: [{ status: 'AVAILABLE', credit_type: 'INDIVIDUAL' }, { status: 'AVAILABLE', credit_type: 'CORPORATE', corporate_profile_id: storeId }] });
    for (const options of [individualUse, corporateUse, bothUse]) {
      const state = resolveListingPackagePageState({ loading: false, options });
      assert.equal(state.status, 'READY');
      if (state.status === 'READY') assert.equal(state.layout, 'MULTI_OPTION');
    }
    assert.equal(individualUse.individual.action, 'USE'); assert.equal(individualUse.corporate?.action, 'BUY');
    assert.equal(corporateUse.individual.action, 'BUY'); assert.equal(corporateUse.corporate?.action, 'USE');
    assert.equal(bothUse.individual.action, 'USE'); assert.equal(bothUse.corporate?.action, 'USE');
  });

  test('fresh package endpoint reflects a newly granted corporate entitlement', async () => {
    db.dealers = [activeDealer()];
    let response = await getPackageOptions(request('/api/listing-package-options'));
    assert.equal((await response.json()).corporate.action, 'BUY');
    db.credits.push({ id: 'corporate-credit', profile_id: profileId, payment_id: 'payment', package_id: 'pkg-corporate', credit_type: 'CORPORATE', corporate_profile_id: storeId, status: 'AVAILABLE', created_at: now } as any);
    response = await getPackageOptions(request('/api/listing-package-options'));
    const refreshed = await response.json();
    assert.equal(refreshed.corporate.action, 'USE'); assert.equal(refreshed.corporate.availableCredits, 1); assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  test('existing rights prevent individual and corporate payment initiation', async () => {
    db.dealers = [activeDealer()];
    db.credits.push({ id: 'individual-credit', profile_id: profileId, payment_id: 'p1', package_id: 'pkg-individual', credit_type: 'INDIVIDUAL', status: 'AVAILABLE', created_at: now } as any);
    let response = await checkout(request('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ packageCode: 'STANDARD_7_DAY' }) }));
    assert.equal(response.status, 409); assert.equal((await response.json()).code, 'ENTITLEMENT_AVAILABLE'); assert.equal(db.payments.length, 0);
    db.credits = [{ id: 'corporate-credit', profile_id: profileId, payment_id: 'p2', package_id: 'pkg-corporate', credit_type: 'CORPORATE', corporate_profile_id: storeId, status: 'AVAILABLE', created_at: now } as any];
    response = await checkout(request('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ packageCode: 'CORPORATE_14_DAY' }) }));
    assert.equal(response.status, 409); assert.equal((await response.json()).code, 'ENTITLEMENT_AVAILABLE'); assert.equal(db.payments.length, 0);
  });

  test('package UI preserves identity routes, loading state and responsive layout', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/ilan-ver/paket/page.tsx'), 'utf8');
    const entry = readFileSync(join(process.cwd(), 'src/app/ilan-ver/page.tsx'), 'utf8');
    const create = readFileSync(join(process.cwd(), 'src/app/ilan-ver/yeni/page.tsx'), 'utf8');
    assert.match(page, /\/ilan-ver\/yeni\?mode=\$\{/);
    assert.match(page, /lg:grid-cols-2/); assert.match(page, /mx-auto grid max-w-2xl/); assert.match(page, /PackageSkeleton/); assert.match(page, /cache: 'no-store'/); assert.match(page, /Bireysel İlan Hakkını Kullan/); assert.match(page, /Kurumsal İlan Hakkını Kullan/);
    assert.match(page, /pageState\.status === 'LOADING'/); assert.match(page, /pageState\.status === 'ERROR'/); assert.doesNotMatch(page, /router\.(push|replace).*yeni.*useEffect/);
    assert.doesNotMatch(page, /text-\[var\(--text-dim\)\)][^>]*>İlan hakkı<\/p>/);
    assert.match(entry, /router\.replace\('\/ilan-ver\/paket'\)/); assert.doesNotMatch(entry, /availableCredits > 0/);
    assert.match(create, /if \(!identityReady\)/); assert.match(create, /mode=\$\{requestedMode\}/); assert.match(create, /useSearchParams\(\)/); assert.match(create, /fetch\('\/api\/listing-package-options', \{ cache: 'no-store', signal: controller\.signal \}\)/);
    assert.match(create, /currentProfile\?\.id/); assert.match(create, /return \(\) => controller\.abort\(\)/); assert.doesNotMatch(create, /window\.location\.search/);
    assert.doesNotMatch(create, /fetch\('\/api\/dealers\/eligibility'/); assert.doesNotMatch(create, /fetch\('\/api\/credits'/);
  });

  test('payment result returns listing publication to the fresh package state', () => {
    const result = readFileSync(join(process.cwd(), 'src/app/odeme/sonuc/page.tsx'), 'utf8');
    const hosted = readFileSync(join(process.cwd(), 'src/app/odeme/[orderId]/page.tsx'), 'utf8');
    assert.match(result, /'\/ilan-ver\/paket'/); assert.match(hosted, /'\/ilan-ver\/paket'/);
  });
});