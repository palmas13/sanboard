import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/lib/db/store';
import { boostListing } from '@/lib/db/dealers';
import { completePaymentOrder, createCheckoutOrder } from '@/lib/db/payments';
import { createListingWithCredit, republishListing } from '@/lib/db/listings';

describe('two-package corporate membership application behavior', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const store = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    db.profiles = [{ id: owner, user_id: 'user', full_name: 'Plus Owner', avatar_url: '', sanmail_email: '', phone: '', created_at: now.toISOString(), updated_at: now.toISOString() }] as any;
    db.dealers = [{ id: store, profile_id: owner, owner_profile_id: owner, company_name: 'Plus Motors', description: '', logo_url: '', banner_url: '', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'INACTIVE', subscription_expires_at: null, purchased_boost_credits: 0, boost_credits: 0, created_at: now.toISOString(), updated_at: now.toISOString() }] as any;
    db.packages = [
      { id: 'standard-membership', code: 'CORPORATE_SUBSCRIPTION_30_DAY', name: 'Standard', price: 5500, duration_days: 30, active: true, seller_type: 'CORPORATE' },
      { id: 'plus-membership', code: 'CORPORATE_PLUS_30_DAY', name: 'Plus', price: 25000, duration_days: 30, active: true, seller_type: 'CORPORATE' },
      { id: 'boost-package', code: 'LISTING_BOOST_24_HOUR', name: 'Boost', price: 1000, duration_days: 1, active: true, seller_type: 'CORPORATE' },
    ] as any;
    db.payments = [];
    db.credits = [];
    db.corporateBoostCredits = [];
    db.listings = [];
  });

  async function buy(code: 'CORPORATE_SUBSCRIPTION_30_DAY' | 'CORPORATE_PLUS_30_DAY', key: string, at = now) {
    const order = await createCheckoutOrder(owner, code, { corporateProfileId: store, idempotencyKey: key });
    assert.equal(order.error, undefined);
    return { order, result: await completePaymentOrder(order.orderId, `external-${key}`, at) };
  }

  test('Plus activation grants exactly twenty new-listing rows and three durable boost rows; replay grants nothing', async () => {
    const { order, result } = await buy('CORPORATE_PLUS_30_DAY', 'plus');
    assert.equal(result.success, true);
    assert.equal(order.amount, 25000);
    assert.equal(db.credits.length, 20);
    assert.ok(db.credits.every((credit) => credit.usage_scope === 'NEW_LISTING_ONLY' && credit.grant_source === 'MEMBERSHIP_PLUS'));
    assert.deepEqual(db.credits.map((credit) => credit.grant_sequence), Array.from({ length: 20 }, (_, index) => index + 1));
    assert.equal(db.corporateBoostCredits.length, 3);
    assert.equal(db.dealers[0].monthly_boost_credits, 0);
    await completePaymentOrder(order.orderId, 'external-plus', new Date('2026-10-06T12:00:00Z'));
    assert.equal(db.credits.length, 20);
    assert.equal(db.corporateBoostCredits.length, 3);
  });

  test('active renewal is same-package only while expired membership may switch package', async () => {
    await buy('CORPORATE_PLUS_30_DAY', 'initial');
    const forbidden = await buy('CORPORATE_SUBSCRIPTION_30_DAY', 'switch-active');
    assert.equal(forbidden.result.success, false);
    assert.match(forbidden.result.error || '', /aynı paket/);
    db.dealers[0].subscription_status = 'EXPIRED';
    db.dealers[0].subscription_expires_at = '2026-10-04T12:00:00.000Z';
    db.dealers[0].current_period_start = '2026-09-04T12:00:00.000Z';
    db.dealers[0].current_period_end = '2026-10-04T12:00:00.000Z';
    const switched = await buy('CORPORATE_SUBSCRIPTION_30_DAY', 'switch-expired');
    assert.equal(switched.result.success, true);
    assert.equal(db.dealers[0].active_package_code, 'CORPORATE_SUBSCRIPTION_30_DAY');
    assert.equal(db.dealers[0].monthly_boost_credits, 3);
  });

  test('Plus listing grants cannot republish an expired listing', async () => {
    await buy('CORPORATE_PLUS_30_DAY', 'republish');
    db.listings = [{ id: 'expired', listing_number: '#1', seller_profile_id: owner, corporate_profile_id: store, seller_type: 'CORPORATE', category: 'vehicle', subcategory: 'car', title: 'Expired', description: '', price: 1, status: 'EXPIRED', expires_at: '2026-10-01T00:00:00Z', created_at: now.toISOString(), updated_at: now.toISOString() }] as any;
    const result = await republishListing('expired', owner);
    assert.equal(result.success, false);
    assert.equal(db.credits.filter((credit) => credit.status === 'AVAILABLE').length, 20);
  });

  test('consumed stale Plus rows cannot be reused or overwritten, while unused Plus remains usable', async () => {
    await buy('CORPORATE_PLUS_30_DAY', 'stale-plus');
    for (const [index, credit] of db.credits.entries()) {
      credit.status = 'AVAILABLE'; credit.used_at = new Date(now.getTime() - 1000).toISOString(); credit.used_listing_id = `previous-${index}`;
    }
    const input = { seller_type: 'CORPORATE', category: 'vehicle', subcategory: 'car', title: 'Fresh', description: '', price: 1 } as any;
    assert.equal((await createListingWithCredit(input, owner)).success, false);
    assert.deepEqual(db.credits.map((credit) => credit.used_listing_id), Array.from({ length: 20 }, (_, index) => `previous-${index}`));
    const usable = db.credits[0]; delete usable.used_at; delete usable.used_listing_id;
    assert.equal((await createListingWithCredit(input, owner)).success, true);
    assert.equal(usable.status, 'USED'); assert.ok(usable.used_at); assert.ok(usable.used_listing_id);
  });

  test('paid corporate credits remain usable for create and republish after Plus exhaustion', async () => {
    await buy('CORPORATE_PLUS_30_DAY', 'paid-fallback');
    for (const credit of db.credits) { credit.status = 'AVAILABLE'; credit.used_at = now.toISOString(); credit.used_listing_id = 'previous'; }
    db.credits.push({ id: 'paid-create', profile_id: owner, payment_id: 'paid-1', package_id: 'paid-package', credit_type: 'CORPORATE', corporate_profile_id: store, status: 'AVAILABLE', used_at: null, usage_scope: 'NEW_OR_REPUBLISH', grant_source: 'PURCHASE', created_at: now.toISOString() } as any);
    const input = { seller_type: 'CORPORATE', category: 'vehicle', subcategory: 'car', title: 'Paid', description: '', price: 1 } as any;
    const created = await createListingWithCredit(input, owner); assert.equal(created.success, true); assert.equal(db.credits.find((credit) => credit.id === 'paid-create')?.status, 'USED');
    assert.ok(created.listing); created.listing!.status = 'EXPIRED';
    db.credits.push({ id: 'paid-republish', profile_id: owner, payment_id: 'paid-2', package_id: 'paid-package', credit_type: 'CORPORATE', corporate_profile_id: store, status: 'AVAILABLE', used_at: null, usage_scope: 'NEW_OR_REPUBLISH', grant_source: 'PURCHASE', created_at: now.toISOString() } as any);
    assert.equal((await republishListing(created.listing!.id, owner)).success, true);
    assert.equal(db.credits.find((credit) => credit.id === 'paid-republish')?.status, 'USED');
    assert.ok(db.credits.filter((credit) => credit.grant_source === 'MEMBERSHIP_PLUS').every((credit) => credit.used_listing_id === 'previous'));
  });

  test('preserved Plus listing rows require an active membership while paid corporate fallback remains eligible', async () => {
    await buy('CORPORATE_PLUS_30_DAY', 'listing-membership');
    db.dealers[0].subscription_status = 'EXPIRED';
    db.dealers[0].subscription_expires_at = '2026-10-04T12:00:00.000Z';
    const input = { seller_type: 'CORPORATE', category: 'vehicle', subcategory: 'car', title: 'Fresh', description: '', price: 1 } as any;
    assert.equal((await createListingWithCredit(input, owner)).success, false);
    db.credits.push({ id: 'paid', profile_id: owner, payment_id: 'paid-payment', package_id: 'paid-package', credit_type: 'CORPORATE', corporate_profile_id: store, status: 'AVAILABLE', usage_scope: 'NEW_OR_REPUBLISH', grant_source: 'PURCHASE', created_at: now.toISOString() });
    assert.equal((await createListingWithCredit(input, owner)).success, true);
    assert.equal(db.credits.find((credit) => credit.id === 'paid')?.status, 'USED');
  });

  test('unused Plus boost rows roll over and are consumed before purchased credits under later Standard membership', async () => {
    await buy('CORPORATE_PLUS_30_DAY', 'preserve');
    db.dealers[0].subscription_status = 'EXPIRED';
    db.dealers[0].subscription_expires_at = '2026-10-04T12:00:00.000Z';
    db.dealers[0].current_period_start = '2026-09-04T12:00:00.000Z';
    db.dealers[0].current_period_end = '2026-10-04T12:00:00.000Z';
    db.dealers[0].purchased_boost_credits = 2;
    await buy('CORPORATE_SUBSCRIPTION_30_DAY', 'standard');
    db.listings = [{ id: 'active', listing_number: '#2', seller_profile_id: owner, corporate_profile_id: store, seller_type: 'CORPORATE', category: 'vehicle', subcategory: 'car', title: 'Active', description: '', price: 1, status: 'ACTIVE', expires_at: '2026-11-01T00:00:00Z', created_at: now.toISOString(), updated_at: now.toISOString() }] as any;
    const result = await boostListing(owner, 'active', now);
    assert.equal(result.success, true);
    assert.equal(db.corporateBoostCredits.filter((credit) => credit.status === 'AVAILABLE').length, 2);
    assert.equal(db.dealers[0].monthly_boost_credits, 3);
    assert.equal(db.dealers[0].purchased_boost_credits, 2);
  });

  test('Standard consumes monthly before purchased and recalculates aggregate counters', async () => {
    await buy('CORPORATE_SUBSCRIPTION_30_DAY', 'standard-counters');
    db.dealers[0].purchased_boost_credits = 2;
    db.dealers[0].boost_credits = 5;
    db.listings = [
      { id: 'monthly', seller_profile_id: owner, corporate_profile_id: store, seller_type: 'CORPORATE', status: 'ACTIVE', expires_at: '2026-11-01T00:00:00Z' },
      { id: 'purchased', seller_profile_id: owner, corporate_profile_id: store, seller_type: 'CORPORATE', status: 'ACTIVE', expires_at: '2026-11-01T00:00:00Z' },
    ] as any;
    const monthly = await boostListing(owner, 'monthly', now);
    assert.equal(monthly.success, true);
    assert.equal(db.dealers[0].monthly_boost_credits, 2);
    assert.equal(db.dealers[0].purchased_boost_credits, 2);
    assert.equal(db.dealers[0].boost_credits, 4);
    db.dealers[0].monthly_boost_credits = 0;
    db.dealers[0].boost_credits = 2;
    const purchased = await boostListing(owner, 'purchased', now);
    assert.equal(purchased.success, true);
    assert.equal(db.dealers[0].monthly_boost_credits, 0);
    assert.equal(db.dealers[0].purchased_boost_credits, 1);
    assert.equal(db.dealers[0].boost_credits, 1);
  });

  test('parallel monthly and purchased attempts cannot consume more credits than available', async () => {
    await buy('CORPORATE_SUBSCRIPTION_30_DAY', 'concurrency');
    db.dealers[0].monthly_boost_credits = 1;
    db.dealers[0].purchased_boost_credits = 0;
    db.dealers[0].boost_credits = 1;
    db.listings = ['a', 'b'].map((id) => ({ id, seller_profile_id: owner, corporate_profile_id: store, seller_type: 'CORPORATE', status: 'ACTIVE', expires_at: '2026-11-01T00:00:00Z' })) as any;
    const monthly = await Promise.all([boostListing(owner, 'a', now), boostListing(owner, 'b', now)]);
    assert.equal(monthly.filter((result) => result.success).length, 1);
    assert.equal(db.dealers[0].monthly_boost_credits, 0);
    db.dealers[0].purchased_boost_credits = 1;
    db.dealers[0].boost_credits = 1;
    db.listings = ['c', 'd'].map((id) => ({ id, seller_profile_id: owner, corporate_profile_id: store, seller_type: 'CORPORATE', status: 'ACTIVE', expires_at: '2026-11-01T00:00:00Z' })) as any;
    const purchased = await Promise.all([boostListing(owner, 'c', now), boostListing(owner, 'd', now)]);
    assert.equal(purchased.filter((result) => result.success).length, 1);
    assert.equal(db.dealers[0].purchased_boost_credits, 0);
  });

  test('one purchased boost payment grants one counter credit and replay grants none', async () => {
    const order = await createCheckoutOrder(owner, 'LISTING_BOOST_24_HOUR', { corporateProfileId: store, purpose: 'LISTING_BOOST', idempotencyKey: 'boost-once' });
    assert.equal((await completePaymentOrder(order.orderId, 'external-boost', now)).success, true);
    assert.equal(db.dealers[0].purchased_boost_credits, 1);
    assert.equal(db.corporateBoostCredits.length, 0);
    assert.equal((await completePaymentOrder(order.orderId, 'external-boost', now)).success, true);
    assert.equal(db.dealers[0].purchased_boost_credits, 1);
    assert.equal(db.corporateBoostCredits.length, 0);
  });

  test('legacy active null package behaves as Standard for renewal and rejects Plus', async () => {
    db.dealers[0].subscription_status = 'ACTIVE';
    db.dealers[0].subscription_expires_at = '2026-10-20T12:00:00.000Z';
    db.dealers[0].active_package_code = null;
    const plus = await buy('CORPORATE_PLUS_30_DAY', 'legacy-plus');
    assert.equal(plus.result.success, false);
    const standard = await buy('CORPORATE_SUBSCRIPTION_30_DAY', 'legacy-standard');
    assert.equal(standard.result.success, true);
  });
});