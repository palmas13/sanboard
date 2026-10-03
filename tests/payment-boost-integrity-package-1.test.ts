import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/db/store';
import { boostListing } from '@/lib/db/dealers';
import { completePaymentOrder, createCheckoutOrder } from '@/lib/db/payments';
import { createSessionToken } from '@/lib/auth/session';
import { POST as boostRoute } from '@/app/api/dealers/boost/route';
import { validateExternalPayment, type VerifiedExternalPayment } from '@/lib/integrations/fleeca';

describe('SANBOARD payment / boost integrity package 1', () => {
  const clock = new Date('2026-09-26T12:00:00.000Z');
  const alexAccount = '11111111-1111-4111-8111-111111111111';
  const jordanAccount = '22222222-2222-4222-8222-222222222222';
  const alex = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const jordan = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const store = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'payment-boost-integrity-package-1-secret';
    db.users = [
      { id: alexAccount, provider: 'GTAWORLD', external_user_id: 'alex-account', role: 'USER', status: 'ACTIVE', created_at: clock.toISOString(), updated_at: clock.toISOString() },
      { id: jordanAccount, provider: 'GTAWORLD', external_user_id: 'jordan-account', role: 'USER', status: 'ACTIVE', created_at: clock.toISOString(), updated_at: clock.toISOString() },
    ];
    db.profiles = [
      { id: alex, user_id: alexAccount, full_name: 'Alex Stone', avatar_url: '', sanmail_email: 'alex@test', phone: '100', created_at: clock.toISOString(), updated_at: clock.toISOString() },
      { id: jordan, user_id: jordanAccount, full_name: 'Jordan Reed', avatar_url: '', sanmail_email: 'jordan@test', phone: '200', created_at: clock.toISOString(), updated_at: clock.toISOString() },
    ] as any;
    db.dealers = [{ id: store, owner_profile_id: alex, profile_id: alex, company_name: 'Alex Motors', description: '', logo_url: '', banner_url: '', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', subscription_expires_at: '2026-11-25T12:00:00.000Z', current_period_start: '2026-09-20T12:00:00.000Z', current_period_end: '2026-10-20T12:00:00.000Z', boost_credits: 3, created_at: clock.toISOString(), updated_at: clock.toISOString() }] as any;
    db.listings = ['one', 'two'].map((id) => ({ id: `listing-${id}`, listing_number: `#${id}`, seller_profile_id: alex, corporate_profile_id: store, seller_type: 'CORPORATE', category: 'vehicle', subcategory: 'Car', title: id, description: id, price: 1, status: 'ACTIVE', expires_at: '2026-10-10T12:00:00.000Z', created_at: clock.toISOString(), updated_at: clock.toISOString() })) as any;
    db.packages = [
      { id: 'subscription', code: 'CORPORATE_SUBSCRIPTION_30_DAY', name: '30 Day', price: 5000, duration_days: 30, active: true, seller_type: 'CORPORATE' },
      { id: 'listing', code: 'STANDARD_7_DAY', name: '7 Day', price: 2000, duration_days: 7, active: true, seller_type: 'INDIVIDUAL' },
    ] as any;
    db.payments = [];
    db.credits = [];
  });

  test('active subscription consumes one boost and same-window replay consumes none', async () => {
    const first = await boostListing(alex, 'listing-one', clock);
    const replay = await boostListing(alex, 'listing-one', clock);
    assert.equal(first.success, true);
    assert.equal(db.dealers[0].boost_credits, 2);
    assert.equal(replay.code, 'ALREADY_BOOSTED');
    assert.equal(db.dealers[0].boost_credits, 2);
  });

  test('expired listing cannot consume a boost credit', async () => {
    db.listings[0].expires_at = clock.toISOString();
    const result = await boostListing(alex, 'listing-one', clock);
    assert.equal(result.success, false);
    assert.equal(result.code, 'LISTING_NOT_ELIGIBLE');
    assert.equal(db.dealers[0].boost_credits, 3);
    assert.notEqual(db.listings[0].is_featured, true);
  });

  test('one credit permits only one of two concurrent requests, including separate listings', async () => {
    db.dealers[0].boost_credits = 1;
    const results = await Promise.all([boostListing(alex, 'listing-one', clock), boostListing(alex, 'listing-two', clock)]);
    assert.equal(results.filter((result) => result.success).length, 1);
    assert.equal(db.dealers[0].boost_credits, 0);
    assert.equal(db.listings.filter((listing) => listing.is_featured).length, 1);
  });

  test('same-listing concurrent double click consumes one credit and creates one boost window', async () => {
    db.dealers[0].boost_credits = 1;
    const results = await Promise.all([boostListing(alex, 'listing-one', clock), boostListing(alex, 'listing-one', clock)]);
    assert.equal(results.filter((result) => result.success).length, 1);
    assert.equal(db.dealers[0].boost_credits, 0);
    assert.equal(db.listings[0].featured_until, '2026-09-27T12:00:00.000Z');
  });

  test('zero credits, expired and inactive subscriptions fail without mutation', async () => {
    db.dealers[0].boost_credits = 0;
    assert.equal((await boostListing(alex, 'listing-one', clock)).code, 'NO_BOOST_CREDITS');
    db.dealers[0].boost_credits = 2;
    db.dealers[0].subscription_expires_at = '2026-09-25T12:00:00.000Z';
    assert.equal((await boostListing(alex, 'listing-one', clock)).code, 'SUBSCRIPTION_EXPIRED');
    db.dealers[0].subscription_expires_at = '2026-11-25T12:00:00.000Z';
    db.dealers[0].subscription_status = 'INACTIVE';
    assert.equal((await boostListing(alex, 'listing-one', clock)).code, 'SUBSCRIPTION_INACTIVE');
    assert.equal(db.dealers[0].boost_credits, 2);
  });

  test('signed active character cannot spend another store credit despite body and routing cookie injection', async () => {
    const token = createSessionToken({ userId: jordanAccount, profileId: jordan, role: 'USER' });
    const request = new NextRequest('http://localhost/api/dealers/boost', { method: 'POST', headers: { cookie: `sanboard_session=${token}; sanboard_profile_id=${alex}`, 'content-type': 'application/json' }, body: JSON.stringify({ dealerId: store, profileId: alex, listingId: 'listing-one' }) });
    const response = await boostRoute(request);
    assert.equal(response.status, 403);
    assert.equal(db.dealers[0].boost_credits, 3);
  });

  test('early renewal extends expiry, refreshes monthly credits, and preserves purchased credits', async () => {
    for (const credits of [1, 0]) {
      db.dealers[0].monthly_boost_credits = credits;
      db.dealers[0].purchased_boost_credits = 2;
      db.dealers[0].boost_credits = credits + 2;
      db.dealers[0].subscription_expires_at = '2026-10-26T12:00:00.000Z';
      db.payments = [];
      const order = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store, idempotencyKey: `renew-${credits}` });
      assert.equal((await completePaymentOrder(order.orderId, `external-${credits}`, clock)).success, true);
      assert.equal(db.dealers[0].subscription_expires_at, '2026-11-26T12:00:00.000Z');
      assert.equal(db.dealers[0].monthly_boost_credits, 3);
      assert.equal(db.dealers[0].purchased_boost_credits, 2);
      assert.equal(db.dealers[0].boost_credits, 5);
    }
  });

  test('invalid initialized period rejects subscription completion without changing expiry or boosts', async () => {
    db.dealers[0].current_period_start = '2026-10-20T12:00:00.000Z';
    db.dealers[0].current_period_end = '2026-10-20T12:00:00.000Z';
    const expiry = db.dealers[0].subscription_expires_at;
    const boosts = db.dealers[0].boost_credits;
    const order = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store });
    const result = await completePaymentOrder(order.orderId, 'invalid-period', clock);
    assert.equal(result.success, false);
    assert.match(result.error || '', /dönemi tutarsızdır/);
    assert.equal(db.dealers[0].subscription_expires_at, expiry);
    assert.equal(db.dealers[0].boost_credits, boosts);
  });

  test('subscription package creation uses centralized price and validates seller type and duration', async () => {
    const canonical = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store });
    assert.equal(canonical.amount, 5500);

    for (const mutation of [
      { seller_type: 'INDIVIDUAL' },
      { duration_days: 29 },
    ]) {
      db.payments = [];
      Object.assign(db.packages[0], mutation);
      const invalid = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store });
      assert.notEqual(invalid.error, undefined);
      Object.assign(db.packages[0], { price: 5000, duration_days: 30, seller_type: 'CORPORATE' });
    }
  });

  test('all orders keep the canonical price snapshot after legacy package price changes', async () => {
    const oldOrder = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store });
    assert.equal(oldOrder.amount, 5500);
    assert.equal(db.payments[0].amount, 5500);

    db.packages[0].price = 6000;
    const oldCompletion = await completePaymentOrder(oldOrder.orderId, 'snapshot-1', clock);
    assert.equal(oldCompletion.success, true);

    const newOrder = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store });
    assert.equal(newOrder.amount, 5500);
    assert.equal(db.payments.find((payment) => payment.order_id === newOrder.orderId)?.amount, 5500);
  });

  test('external verification uses each stored order amount rather than the live package price', async () => {
    const oldOrder = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store });
    db.packages[0].price = 6000;
    const newOrder = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store });
    const transaction = (orderReference: string, amount: number): VerifiedExternalPayment => ({
      externalTransactionId: `external-${orderReference}-${amount}`,
      status: 'VERIFIED',
      orderReference,
      payerReference: alex,
      amount,
      currency: 'GTA_DOLLAR',
      purposeReference: 'CORPORATE_SUBSCRIPTION_30_DAY',
      occurredAt: clock.toISOString(),
    });
    const expectation = (orderReference: string, amount: number) => ({
      orderReference,
      payerReference: alex,
      amount,
      currency: 'GTA_DOLLAR',
      purposeReference: 'CORPORATE_SUBSCRIPTION_30_DAY',
    });

    assert.deepEqual(validateExternalPayment(transaction(oldOrder.orderId, 6000), expectation(oldOrder.orderId, 5000)), { verified: false, reason: 'WRONG_AMOUNT' });
    assert.deepEqual(validateExternalPayment(transaction(newOrder.orderId, 5000), expectation(newOrder.orderId, 6000)), { verified: false, reason: 'WRONG_AMOUNT' });
    assert.equal(validateExternalPayment(transaction(oldOrder.orderId, 5000), expectation(oldOrder.orderId, 5000)).verified, true);
    assert.equal(validateExternalPayment(transaction(newOrder.orderId, 6000), expectation(newOrder.orderId, 6000)).verified, true);
  });

  test('completion rejects nonpositive snapshots and disabled or structurally invalid packages', async () => {
    for (const mutate of [
      () => { db.payments[0].amount = 0; },
      () => { db.payments[0].amount = -1; },
      () => { db.packages[0].active = false; },
      () => { db.packages[0].code = 'UNKNOWN'; },
      () => { db.packages[0].seller_type = 'INDIVIDUAL'; },
      () => { db.packages[0].duration_days = 29; },
    ]) {
      db.payments = [];
      Object.assign(db.packages[0], { code: 'CORPORATE_SUBSCRIPTION_30_DAY', price: 5000, duration_days: 30, active: true, seller_type: 'CORPORATE' });
      const order = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store });
      mutate();
      assert.equal((await completePaymentOrder(order.orderId, `invalid-${Math.random()}`, clock)).success, false);
    }
  });

  test('same external transaction cannot fund another order and same order replay grants no second entitlement', async () => {
    const first = await createCheckoutOrder(alex, 'STANDARD_7_DAY');
    const second = await createCheckoutOrder(alex, 'STANDARD_7_DAY');
    assert.equal((await completePaymentOrder(first.orderId, 'shared-external', clock)).success, true);
    assert.equal((await completePaymentOrder(first.orderId, 'shared-external', clock)).success, true);
    assert.equal(db.credits.length, 1);
    assert.equal((await completePaymentOrder(second.orderId, 'shared-external', clock)).success, false);
    assert.equal(db.credits.length, 1);
  });

  test('legacy active renewal initializes a technical period and refreshes monthly credits', async () => {
    for (const credits of [0, 1]) {
      db.dealers[0].monthly_boost_credits = credits;
      db.dealers[0].purchased_boost_credits = 1;
      db.dealers[0].boost_credits = credits + 1;
      db.dealers[0].subscription_status = 'ACTIVE';
      db.dealers[0].subscription_expires_at = '2026-10-26T12:00:00.000Z';
      db.dealers[0].current_period_start = undefined;
      db.dealers[0].current_period_end = undefined;
      db.payments = [];
      const order = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', {
        corporateProfileId: store,
        idempotencyKey: `legacy-renew-${credits}`,
      });
      assert.equal((await completePaymentOrder(order.orderId, `legacy-external-${credits}`, clock)).success, true);
      assert.equal(db.dealers[0].subscription_expires_at, '2026-11-26T12:00:00.000Z');
      assert.equal(db.dealers[0].monthly_boost_credits, 3);
      assert.equal(db.dealers[0].purchased_boost_credits, 1);
      assert.equal(db.dealers[0].boost_credits, 4);
      assert.equal(db.dealers[0].current_period_start, clock.toISOString());
      assert.equal(db.dealers[0].current_period_end, '2026-10-26T12:00:00.000Z');
    }
  });

  test('legacy null period initialization on boost preserves credits and caps period at prepaid expiry', async () => {
    db.dealers[0].boost_credits = 1;
    db.dealers[0].subscription_expires_at = '2026-10-01T12:00:00.000Z';
    db.dealers[0].current_period_start = undefined;
    db.dealers[0].current_period_end = undefined;
    const result = await boostListing(alex, 'listing-one', clock);
    assert.equal(result.success, true);
    assert.equal(db.dealers[0].boost_credits, 0);
    assert.equal(db.dealers[0].current_period_start, clock.toISOString());
    assert.equal(db.dealers[0].current_period_end, '2026-10-01T12:00:00.000Z');
  });

  test('null boost credits are denied fail-safe without featuring the listing', async () => {
    (db.dealers[0] as any).boost_credits = null;
    const result = await boostListing(alex, 'listing-one', clock);
    assert.equal(result.success, false);
    assert.equal(result.code, 'NO_BOOST_CREDITS');
    assert.notEqual(db.listings[0].is_featured, true);
  });

  test('new period grants exactly three once and subscription payment replay does not extend twice', async () => {
    db.dealers[0].subscription_status = 'EXPIRED';
    db.dealers[0].subscription_expires_at = '2026-09-25T12:00:00.000Z';
    db.dealers[0].current_period_end = '2026-09-25T12:00:00.000Z';
    db.dealers[0].boost_credits = 0;
    const order = await createCheckoutOrder(alex, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store, idempotencyKey: 'new-period' });
    await completePaymentOrder(order.orderId, 'external-new-period', clock);
    const expiry = db.dealers[0].subscription_expires_at;
    assert.equal(db.dealers[0].boost_credits, 3);
    assert.equal(db.dealers[0].current_period_start, clock.toISOString());
    await completePaymentOrder(order.orderId, 'external-new-period', new Date('2026-09-27T12:00:00.000Z'));
    assert.equal(db.dealers[0].subscription_expires_at, expiry);
    assert.equal(db.dealers[0].boost_credits, 3);
  });

  test('elapsed prepaid period resets to exactly three once and never exceeds subscription expiry', async () => {
    db.dealers[0].subscription_expires_at = '2026-10-01T12:00:00.000Z';
    db.dealers[0].current_period_start = '2026-08-26T12:00:00.000Z';
    db.dealers[0].current_period_end = '2026-09-25T12:00:00.000Z';
    db.dealers[0].boost_credits = 0;
    const first = await boostListing(alex, 'listing-one', clock);
    assert.equal(first.success, true);
    assert.equal(db.dealers[0].boost_credits, 2);
    assert.equal(db.dealers[0].current_period_end, '2026-10-01T12:00:00.000Z');
    const replay = await boostListing(alex, 'listing-one', clock);
    assert.equal(replay.code, 'ALREADY_BOOSTED');
    assert.equal(db.dealers[0].boost_credits, 2);
  });

  test('listing credit payment replay creates one entitlement', async () => {
    const order = await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'listing-credit' });
    await completePaymentOrder(order.orderId, 'external-listing', clock);
    await completePaymentOrder(order.orderId, 'external-listing', clock);
    assert.equal(db.credits.length, 1);
  });

  test('migration is atomic/service-role-only and preflight/postflight are read-only', () => {
    const packageMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260926055000_corporate_subscription_package.sql'), 'utf8');
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260926060000_payment_boost_integrity_package_1.sql'), 'utf8');
    const preflight = readFileSync(join(process.cwd(), 'supabase/scripts/payment_boost_integrity_package_1_preflight.sql'), 'utf8');
    const postflight = readFileSync(join(process.cwd(), 'supabase/scripts/payment_boost_integrity_package_1_postflight.sql'), 'utf8');
    const activeWindowMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260929120000_enforce_active_boost_window.sql'), 'utf8');
    assert.match(migration, /consume_corporate_boost[\s\S]*FOR UPDATE[\s\S]*boost_credits = boost_credits - 1/);
    assert.match(migration, /subscription_status <> 'ACTIVE'[\s\S]*subscription_expires_at IS NULL OR v_store\.subscription_expires_at <= v_now/);
    assert.match(migration, /CASE WHEN v_new_period THEN 3 ELSE boost_credits END/);
    assert.match(migration, /current_period_end = LEAST\(NOW\(\) \+ INTERVAL '30 days', subscription_expires_at\)/);
    assert.match(migration, /boost_credits IS NULL OR v_store\.boost_credits <= 0/);
    assert.match(migration, /VALIDATE CONSTRAINT chk_corporate_profiles_boost_credits_nonnegative/);
    assert.match(migration, /REVOKE ALL ON FUNCTION public\.consume_corporate_boost[\s\S]*GRANT EXECUTE[\s\S]*service_role/);
    assert.match(migration, /CHECK \(boost_credits >= 0\)/);
    assert.match(migration, /current_period_start >= v_store\.current_period_end/);
    assert.match(activeWindowMigration, /v_listing\.expires_at IS NULL OR v_listing\.expires_at <= v_now/);
    assert.match(activeWindowMigration, /v_now \+ INTERVAL '24 hours'/);
    assert.match(migration, /NOT v_package\.active OR v_payment\.amount <= 0/);
    assert.doesNotMatch(migration, /v_payment\.amount <> v_package\.price/);
    assert.match(packageMigration, /INSERT INTO public\.packages/);
    assert.match(packageMigration, /'CORPORATE_SUBSCRIPTION_30_DAY'[\s\S]*'30 Günlük Kurumsal Üyelik'[\s\S]*5000[\s\S]*'CORPORATE'[\s\S]*30[\s\S]*TRUE/);
    assert.doesNotMatch(packageMigration, /INSERT INTO public\.packages\s*\(\s*id/i);
    assert.doesNotMatch(packageMigration, /ON CONFLICT[\s\S]*DO UPDATE/i);
    assert.match(packageMigration, /RAISE EXCEPTION/);
    assert.match(preflight, /information_schema\.columns/);
    assert.match(preflight, /STANDARD_7_DAY[\s\S]*CORPORATE_14_DAY[\s\S]*CORPORATE_SUBSCRIPTION_30_DAY/);
    assert.doesNotMatch(preflight, /SELECT[\s\S]{0,300}current_period_start\s*,\s*current_period_end\s+FROM public\.corporate_profiles/i);
    assert.doesNotMatch(preflight.replace(/^\s*--.*$/gm, ''), /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
    assert.doesNotMatch(postflight.replace(/^\s*--.*$/gm, ''), /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
    assert.match(preflight, /MISSING[\s\S]*MISMATCH[\s\S]*MATCH/);
    assert.match(postflight, /subscription_package_row_count[\s\S]*canonical_subscription_package_row_count/);
    for (const check of ['start_without_end', 'end_without_start', 'start_not_before_end', 'period_beyond_subscription', 'active_future_with_null_period', 'expired_subscription_with_future_period', 'null_boost_credits', 'negative_boost_credits']) {
      assert.match(postflight, new RegExp(check));
    }
  });

  test('pricing migration converts legacy Boost entitlements between constraint drop and replacement', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20261003010000_pricing_and_corporate_boost_credits.sql'), 'utf8');
    const dropConstraint = migration.indexOf('ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_entitlement_type;');
    const convertEntitlement = migration.indexOf("SET entitlement_type = 'BOOST_CREDIT'");
    const addConstraint = migration.indexOf('ALTER TABLE public.payments ADD CONSTRAINT chk_payments_entitlement_type');

    assert.ok(dropConstraint >= 0, 'legacy entitlement constraint must be dropped');
    assert.ok(convertEntitlement >= 0, 'legacy Boost entitlements must be converted');
    assert.ok(addConstraint >= 0, 'replacement entitlement constraint must be installed');
    assert.ok(dropConstraint < convertEntitlement, 'constraint drop must precede the BOOST_CREDIT conversion');
    assert.ok(convertEntitlement < addConstraint, 'BOOST_CREDIT conversion must precede the replacement constraint');
    assert.match(migration.slice(addConstraint), /CHECK \(entitlement_type IN \('LISTING_CREDIT', 'BOOST_CREDIT', 'CORPORATE_SUBSCRIPTION'\)\)/);
  });
});