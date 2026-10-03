import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/lib/db/store';
import { createCheckoutOrder } from '@/lib/db/payments';
import { verifyAndFulfillPayment } from '@/lib/payments/verification';
import { RealFleecaPaymentProvider } from '@/lib/integrations/fleeca/real-provider';
import { normalizeFleecaPayerName } from '@/lib/payments/payer-identity';

describe('character-bound Fleeca payer verification', () => {
  const now = '2026-10-03T12:00:00.000Z';
  const zade = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const leo = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const store = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  let originalGetPaymentDetails: typeof RealFleecaPaymentProvider.prototype.getPaymentDetails;

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    originalGetPaymentDetails = RealFleecaPaymentProvider.prototype.getPaymentDetails;
    db.profiles = [
      { id: zade, user_id: 'user-zade', external_character_id: 'gta-zade', full_name: 'Zade Vexnera', avatar_url: '', sanmail_email: '', phone: '', created_at: now, updated_at: now },
      { id: leo, user_id: 'user-leo', external_character_id: 'gta-leo', full_name: 'Leo Cassano', avatar_url: '', sanmail_email: '', phone: '', created_at: now, updated_at: now },
    ];
    db.packages = [
      { id: 'individual', code: 'STANDARD_7_DAY', name: 'Individual', price: 1500, duration_days: 7, active: true, seller_type: 'INDIVIDUAL' },
      { id: 'subscription', code: 'CORPORATE_SUBSCRIPTION_30_DAY', name: 'Subscription', price: 5500, duration_days: 30, active: true, seller_type: 'CORPORATE' },
      { id: 'boost', code: 'LISTING_BOOST_24_HOUR', name: 'Boost', price: 1000, duration_days: 1, active: true, seller_type: 'CORPORATE' },
    ] as any;
    db.dealers = [{
      id: store, profile_id: zade, owner_profile_id: zade, company_name: 'Zade Motors', description: '', logo_url: '', banner_url: '',
      status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'INACTIVE', subscription_expires_at: null,
      monthly_boost_credits: 0, purchased_boost_credits: 0, boost_credits: 0, created_at: now, updated_at: now,
    }] as any;
    db.payments = [];
    db.credits = [];
    db.characterFleecaAccounts = [];
  });

  const create = async (profileId = zade, packageCode = 'STANDARD_7_DAY', options: Record<string, unknown> = {}) => {
    const profile = db.profiles.find((item) => item.id === profileId)!;
    const order = await createCheckoutOrder(profileId, packageCode, {
      idempotencyKey: crypto.randomUUID(),
      expectedExternalCharacterId: profile.external_character_id,
      expectedCharacterName: profile.full_name,
      ...options,
    });
    const payment = db.payments.find((item) => item.order_id === order.orderId)!;
    payment.external_payment_id = crypto.randomUUID();
    return payment;
  };

  const providerReturns = (payment: any, payerName: string | null, payerRouting: string | number | null) => {
    RealFleecaPaymentProvider.prototype.getPaymentDetails = async () => ({
      success: true as const,
      data: {
        payment_id: payment.external_payment_id!, merchant_id: 1, amount: payment.amount,
        description: 'Sanboard payment', status: 'payment_successful', mode: 'live' as const,
        payer_name: payerName, payer_routing: payerRouting, paid_at: now, created_at: now, updated_at: now,
      },
    });
  };

  test.afterEach(() => {
    RealFleecaPaymentProvider.prototype.getPaymentDetails = originalGetPaymentDetails;
  });

  test('Zade pays with Zade account, leading-zero routing is preserved, and duplicate polling fulfills once', async () => {
    const payment = await create();
    providerReturns(payment, '  zAdE   vExNeRa ', '020001001');
    assert.equal((await verifyAndFulfillPayment(payment)).state, 'SUCCESS');
    assert.equal((await verifyAndFulfillPayment(payment)).state, 'SUCCESS');
    assert.equal(payment.payer_identity_status, 'VERIFIED');
    assert.equal(db.characterFleecaAccounts[0].payer_routing, '020001001');
    assert.equal(db.characterFleecaAccounts[0].profile_id, zade);
    assert.equal(db.credits.length, 1);
  });

  test('Zade paid by Leo is rejected, creates no mapping, and does not infer Leo ownership', async () => {
    const payment = await create();
    providerReturns(payment, 'Leo Cassano', '030002002');
    const result = await verifyAndFulfillPayment(payment);
    assert.equal(result.state, 'UNVERIFIED');
    assert.equal(result.failureCode, 'PAYER_NAME_MISMATCH');
    assert.equal(payment.payer_identity_status, 'MISMATCH');
    assert.equal(payment.entitlement_applied_at, undefined);
    assert.equal(db.characterFleecaAccounts.length, 0);
    assert.equal(db.credits.length, 0);
  });

  test('mismatch does not poison a later correct Zade payment or future legitimate Leo assignment', async () => {
    const wrong = await create();
    providerReturns(wrong, 'Leo Cassano', '030002002');
    await verifyAndFulfillPayment(wrong);

    const correctZade = await create();
    providerReturns(correctZade, 'Zade Vexnera', '020001001');
    assert.equal((await verifyAndFulfillPayment(correctZade)).state, 'SUCCESS');

    const correctLeo = await create(leo);
    providerReturns(correctLeo, 'Leo Cassano', '030002002');
    assert.equal((await verifyAndFulfillPayment(correctLeo)).state, 'SUCCESS');
    assert.deepEqual(db.characterFleecaAccounts.map((item) => [item.payer_routing, item.profile_id]).sort(), [
      ['020001001', zade], ['030002002', leo],
    ]);
  });

  test('same verified routing is reusable by the same profile but conflicts for another profile', async () => {
    const first = await create();
    providerReturns(first, 'Zade Vexnera', '020001001');
    assert.equal((await verifyAndFulfillPayment(first)).state, 'SUCCESS');
    const second = await create();
    providerReturns(second, 'Zade Vexnera', '020001001');
    assert.equal((await verifyAndFulfillPayment(second)).state, 'SUCCESS');
    assert.equal(db.characterFleecaAccounts.length, 1);

    const conflict = await create(leo);
    providerReturns(conflict, 'Leo Cassano', '020001001');
    const result = await verifyAndFulfillPayment(conflict);
    assert.equal(result.failureCode, 'PAYER_ROUTING_CONFLICT');
    assert.equal(conflict.entitlement_applied_at, undefined);
    assert.equal(db.characterFleecaAccounts[0].profile_id, zade);
  });

  test('missing payer name and routing fail closed without mappings', async () => {
    const missingName = await create();
    providerReturns(missingName, null, '020001001');
    assert.equal((await verifyAndFulfillPayment(missingName)).failureCode, 'PAYER_NAME_MISSING');
    const missingRouting = await create();
    providerReturns(missingRouting, 'Zade Vexnera', null);
    assert.equal((await verifyAndFulfillPayment(missingRouting)).failureCode, 'PAYER_ROUTING_MISSING');
    assert.equal(db.characterFleecaAccounts.length, 0);
    assert.equal(db.credits.length, 0);
  });

  test('individual listing, corporate subscription, and corporate Boost remain fulfillable', async () => {
    const individual = await create();
    providerReturns(individual, 'Zade Vexnera', '020001001');
    assert.equal((await verifyAndFulfillPayment(individual)).state, 'SUCCESS');

    const subscription = await create(zade, 'CORPORATE_SUBSCRIPTION_30_DAY', { corporateProfileId: store, purpose: 'CORPORATE_SUBSCRIPTION' });
    providerReturns(subscription, 'Zade Vexnera', '020001001');
    assert.equal((await verifyAndFulfillPayment(subscription)).state, 'SUCCESS');
    assert.equal(db.dealers[0].subscription_status, 'ACTIVE');

    const boost = await create(zade, 'LISTING_BOOST_24_HOUR', { corporateProfileId: store, purpose: 'LISTING_BOOST' });
    providerReturns(boost, 'Zade Vexnera', '020001001');
    assert.equal((await verifyAndFulfillPayment(boost)).state, 'SUCCESS');
    assert.equal(db.dealers[0].purchased_boost_credits, 1);
  });

  test('legacy historical payment without identity snapshots remains valid', async () => {
    const order = await createCheckoutOrder(zade, 'STANDARD_7_DAY', { idempotencyKey: 'legacy' });
    const payment = db.payments.find((item) => item.order_id === order.orderId)!;
    payment.external_payment_id = crypto.randomUUID();
    providerReturns(payment, null, null);
    assert.equal((await verifyAndFulfillPayment(payment)).state, 'SUCCESS');
    assert.equal(db.characterFleecaAccounts.length, 0);
    assert.equal(db.credits.length, 1);
  });

  test('normalization is conservative and does not fuzzy-match', () => {
    assert.equal(normalizeFleecaPayerName('  ZADE   VEXNERA '), 'zade vexnera');
    assert.notEqual(normalizeFleecaPayerName('Zade Vexner'), normalizeFleecaPayerName('Zade Vexnera'));
  });
});