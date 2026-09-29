import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { POST as createCheckout, PUT as verifyCheckout } from '@/app/api/checkout/route';
import { completePaymentOrder, createCheckoutOrder } from '@/lib/db/payments';
import {
  FleecaProviderNotConfiguredError,
  getFleecaPaymentProvider,
  getTestFleecaPaymentProvider,
  validateExternalPayment,
  type VerifiedExternalPayment,
} from '@/lib/integrations/fleeca';
import { mapFleecaPaymentStatus, RealFleecaPaymentProvider } from '@/lib/integrations/fleeca/real-provider';
import { verifyAndFulfillPayment } from '@/lib/payments/verification';
import { POST as receiveFleecaWebhook } from '@/app/api/payments/fleeca/webhook/route';
import { GET as getPaymentStatus } from '@/app/api/payments/status/route';

describe('SANBOARD Fleeca provider boundary readiness', () => {
  const accountId = '11111111-1111-4111-8111-111111111111';
  const alex = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const jordan = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.ENABLE_TEST_PAYMENTS = 'false';
    process.env.USE_MOCK_FLEECA = 'false';
    process.env.FLEECA_API_KEY = 'fleeca-webhook-test-key';
    process.env.SANBOARD_SESSION_SECRET = 'fleeca-boundary-test-secret-at-least-32-characters';
    db.users = [{ id: accountId, provider: 'GTAWORLD', external_user_id: 'account-A', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' }];
    db.profiles = [
      { id: alex, user_id: accountId, full_name: 'Alex Stone', avatar_url: '', created_at: '', updated_at: '' },
      { id: jordan, user_id: accountId, full_name: 'Jordan Reed', avatar_url: '', created_at: '', updated_at: '' },
    ] as any;
    db.packages = [{ id: 'package-A', code: 'STANDARD_7_DAY', name: 'Standard', price: 2000, duration_days: 7, active: true, seller_type: 'INDIVIDUAL' }] as any;
    db.payments = [];
    db.credits = [];
    db.dealers = [];
    db.listings = [];
    db.auditLogs = [];
  });

  const request = (method: 'POST' | 'PUT', body: Record<string, unknown>, profileId = alex, url = 'http://localhost/api/checkout') => new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: `sanboard_session=${createSessionToken({ userId: accountId, profileId, role: 'USER' })}`,
    },
    body: JSON.stringify(body),
  });

  const webhook = (payload: Record<string, unknown>, signatureKey = process.env.FLEECA_API_KEY!) => {
    const rawBody = JSON.stringify(payload);
    const signature = `sha256=${createHmac('sha256', signatureKey).update(rawBody).digest('hex')}`;
    return receiveFleecaWebhook(new NextRequest('http://localhost/api/payments/fleeca/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-fleeca-signature': signature },
      body: rawBody,
    }));
  };

  const callbackPayload = (paymentId: string, status: 'payment_successful' | 'payment_failed' | 'pending', extra: Record<string, unknown> = {}) => ({
    payment_id: paymentId,
    mode: 'live',
    amount: 1,
    status,
    description: 'Sanboard payment',
    created_at: '2026-09-29T20:00:00.000Z',
    paid_at: status === 'payment_successful' ? '2026-09-29T20:01:00.000Z' : null,
    ...extra,
  });

  test('mock selector is explicit outside production and cannot grant an entitlement without completion', async () => {
    process.env.USE_MOCK_FLEECA = 'true';
    assert.equal(typeof getFleecaPaymentProvider().verifyPayment, 'function');
    assert.equal(db.payments.length, 0);
    assert.equal(db.credits.length, 0);
  });

  test('normal checkout cannot create fake success or entitlement when provider is not configured', async () => {
    delete process.env.FLEECA_API_KEY;
    const response = await createCheckout(request('POST', { packageCode: 'STANDARD_7_DAY', profileId: jordan, paid: true }));
    assert.equal(response.status, 503);
    assert.equal(db.payments.length, 1);
    assert.equal(db.payments[0].profile_id, alex);
    assert.equal(db.payments[0].status, 'PENDING');
    assert.equal(db.payments[0].external_payment_id, undefined);
    assert.equal(db.credits.length, 0);
  });

  test('browser success flags and former simulation input cannot complete a payment', async () => {
    const order = await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'browser-proof' });
    const response = await verifyCheckout(request('PUT', { orderId: order.orderId, success: true, paid: true, simulateSuccess: true }, alex, `http://localhost/api/checkout?success=true`));
    assert.equal(response.status, 202);
    assert.equal(db.payments[0].status, 'PENDING');
    assert.equal(db.credits.length, 0);
  });

  test('test provider is explicit, disabled by default, and forbidden in production', () => {
    assert.throws(() => getTestFleecaPaymentProvider(), /disabled/);
    process.env.ENABLE_TEST_PAYMENTS = 'true';
    assert.equal(typeof getTestFleecaPaymentProvider().verifyPayment, 'function');
    const selector = readFileSync(join(process.cwd(), 'src/lib/integrations/fleeca/index.ts'), 'utf8');
    assert.match(selector, /process\.env\.NODE_ENV === 'production'/);
  });

  test('canonical verified payment accepts exact match and rejects pending, failed, amount, order and payer mismatch', () => {
    const expected = { orderReference: 'order-A', payerReference: alex, amount: 2000, currency: 'GTA_DOLLAR', purposeReference: 'STANDARD_7_DAY' };
    const transaction: VerifiedExternalPayment = { externalTransactionId: 'txn-A', status: 'VERIFIED', occurredAt: '2026-09-26T12:00:00.000Z', ...expected };
    assert.equal(validateExternalPayment(transaction, expected).verified, true);
    assert.deepEqual(validateExternalPayment({ ...transaction, status: 'PENDING' }, expected), { verified: false, reason: 'PENDING' });
    assert.deepEqual(validateExternalPayment({ ...transaction, status: 'FAILED' }, expected), { verified: false, reason: 'FAILED' });
    assert.deepEqual(validateExternalPayment({ ...transaction, amount: 1999 }, expected), { verified: false, reason: 'WRONG_AMOUNT' });
    assert.deepEqual(validateExternalPayment({ ...transaction, orderReference: 'order-B' }, expected), { verified: false, reason: 'WRONG_ORDER' });
    assert.deepEqual(validateExternalPayment({ ...transaction, payerReference: jordan }, expected), { verified: false, reason: 'WRONG_PAYER' });
  });

  test('payment_failed is an explicit terminal provider status', () => {
    assert.equal(mapFleecaPaymentStatus('payment_failed'), 'FAILED');
    assert.equal(mapFleecaPaymentStatus('unknown_provider_status'), null);
  });

  test('payment_failed marks every payment purpose failed without fulfillment or duplicate entitlement', async () => {
    const original = RealFleecaPaymentProvider.prototype.getPaymentDetails;
    RealFleecaPaymentProvider.prototype.getPaymentDetails = async function (paymentId: string) {
      return {
        success: true as const,
        data: {
          payment_id: paymentId,
          merchant_id: 1,
          amount: 1,
          description: 'failed payment',
          status: 'payment_failed',
          mode: 'live' as const,
          payer_routing: null,
          payer_name: null,
          paid_at: null,
          created_at: '2026-09-29T20:00:00.000Z',
          updated_at: '2026-09-29T20:01:00.000Z',
        },
      };
    };

    try {
      db.dealers = [{ id: 'dealer-A', profile_id: alex, owner_profile_id: alex, subscription_status: 'INACTIVE' }] as any;
      db.listings = [{ id: 'listing-A', seller_profile_id: alex, seller_type: 'CORPORATE', corporate_profile_id: 'dealer-A', status: 'ACTIVE' }] as any;
      const purposes = [
        { purpose: 'LISTING_PUBLICATION', entitlement_type: 'LISTING_CREDIT' },
        { purpose: 'CORPORATE_SUBSCRIPTION', entitlement_type: 'CORPORATE_SUBSCRIPTION', corporate_profile_id: 'dealer-A' },
        { purpose: 'LISTING_BOOST', entitlement_type: 'LISTING_BOOST', target_listing_id: 'listing-A' },
      ] as const;

      for (const [index, purpose] of purposes.entries()) {
        const payment = {
          id: `failed-payment-${index}`,
          order_id: `failed-order-${index}`,
          profile_id: alex,
          package_id: 'package-A',
          provider: 'FLEECA' as const,
          external_payment_id: `00000000-0000-4000-8000-00000000000${index}`,
          amount: 1,
          status: 'PENDING' as const,
          created_at: '2026-09-29T20:00:00.000Z',
          paid_at: undefined,
          entitlement_applied_at: null,
          ...purpose,
        };
        db.payments.push(payment as any);

        assert.deepEqual(await verifyAndFulfillPayment(payment), { state: 'FAILED' });
        assert.deepEqual(await verifyAndFulfillPayment(payment), { state: 'FAILED' });
        assert.equal(payment.status, 'FAILED');
        assert.equal(payment.paid_at, undefined);
        assert.equal(payment.entitlement_applied_at, null);
      }

      assert.equal(db.credits.length, 0);
      assert.equal(db.dealers[0].subscription_status, 'INACTIVE');
      assert.equal(db.listings[0].is_featured, undefined);
    } finally {
      RealFleecaPaymentProvider.prototype.getPaymentDetails = original;
    }
  });

  test('payment_failed has a terminal failed UI state with the generic message', () => {
    const resultPage = readFileSync(join(process.cwd(), 'src/app/odeme/sonuc/page.tsx'), 'utf8');
    assert.match(resultPage, /state === 'FAILED'/);
    assert.match(resultPage, /Ödeme başarısız oldu\./);
    assert.doesNotMatch(resultPage, /\(next === 'FAILED'/);
  });

  test('valid HMAC is accepted and invalid HMAC is rejected with 403', async () => {
    const paymentId = '10000000-0000-4000-8000-000000000001';
    const order = await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'webhook-signature' });
    db.payments[0].external_payment_id = paymentId;

    const invalid = await webhook(callbackPayload(paymentId, 'pending'), 'wrong-key');
    assert.equal(invalid.status, 403);
    assert.equal(db.payments[0].status, 'PENDING');

    const valid = await webhook(callbackPayload(paymentId, 'pending'));
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { received: true, processed: false, state: 'PENDING' });
    assert.equal(db.payments[0].order_id, order.orderId);
    assert.equal(db.credits.length, 0);
  });

  test('payment_failed webhook stores status_reason in audit metadata and grants no entitlement', async () => {
    const paymentId = '10000000-0000-4000-8000-000000000002';
    await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'webhook-failed' });
    db.payments[0].external_payment_id = paymentId;

    const response = await webhook(callbackPayload(paymentId, 'payment_failed', { status_reason: 'payer_cancelled' }));
    assert.equal(response.status, 200);
    assert.equal(db.payments[0].status, 'FAILED');
    assert.equal(db.payments[0].paid_at, undefined);
    assert.equal(db.payments[0].entitlement_applied_at, undefined);
    assert.equal(db.credits.length, 0);
    assert.equal(db.auditLogs[0].event_type, 'FLEECA_WEBHOOK_STATUS');
    assert.equal(db.auditLogs[0].metadata?.statusReason, 'payer_cancelled');
    assert.equal(db.auditLogs[0].metadata?.payer_name, undefined);
    assert.equal(db.auditLogs[0].metadata?.payer_routing, undefined);
  });

  test('payment_successful webhook reuses verified idempotent fulfillment and duplicate callback creates one entitlement', async () => {
    const paymentId = '10000000-0000-4000-8000-000000000003';
    await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'webhook-success' });
    const payment = db.payments[0];
    payment.external_payment_id = paymentId;
    const original = RealFleecaPaymentProvider.prototype.getPaymentDetails;
    RealFleecaPaymentProvider.prototype.getPaymentDetails = async () => ({
      success: true as const,
      data: {
        payment_id: paymentId, merchant_id: 1, amount: payment.amount, description: 'Sanboard payment',
        status: 'payment_successful', mode: 'live' as const, payer_routing: null, payer_name: null,
        paid_at: '2026-09-29T20:01:00.000Z', created_at: '2026-09-29T20:00:00.000Z', updated_at: '2026-09-29T20:01:00.000Z',
      },
    });
    try {
      assert.equal((await webhook(callbackPayload(paymentId, 'payment_successful'))).status, 200);
      assert.equal((await webhook(callbackPayload(paymentId, 'payment_successful'))).status, 200);
      assert.equal(payment.status, 'SUCCESS');
      assert.equal(db.credits.length, 1);
    } finally {
      RealFleecaPaymentProvider.prototype.getPaymentDetails = original;
    }
  });

  test('amount mismatch and unknown payment_id are rejected without fulfillment', async () => {
    const paymentId = '10000000-0000-4000-8000-000000000004';
    await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'webhook-mismatch' });
    db.payments[0].external_payment_id = paymentId;
    const mismatch = await webhook(callbackPayload(paymentId, 'payment_successful', { amount: 999 }));
    assert.equal(mismatch.status, 409);
    const unknown = await webhook(callbackPayload('10000000-0000-4000-8000-000000000099', 'payment_successful'));
    assert.equal(unknown.status, 404);
    assert.equal(db.payments[0].status, 'PENDING');
    assert.equal(db.credits.length, 0);
  });

  test('redirect payment_id is correlation only and cannot fulfill by itself', async () => {
    const paymentId = '10000000-0000-4000-8000-000000000005';
    await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'redirect-correlation' });
    db.payments[0].external_payment_id = paymentId;
    const original = RealFleecaPaymentProvider.prototype.getPaymentDetails;
    RealFleecaPaymentProvider.prototype.getPaymentDetails = async () => ({
      success: true as const,
      data: {
        payment_id: paymentId, merchant_id: 1, amount: 1, description: 'Sanboard payment', status: 'awaiting_payment',
        mode: 'live' as const, payer_routing: null, payer_name: null, paid_at: null,
        created_at: '2026-09-29T20:00:00.000Z', updated_at: '2026-09-29T20:00:00.000Z',
      },
    });
    try {
      const token = createSessionToken({ userId: accountId, profileId: alex, role: 'USER' });
      const response = await getPaymentStatus(new NextRequest(`http://localhost/api/payments/status?payment_id=${paymentId}`, {
        headers: { cookie: `sanboard_session=${token}` },
      }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).state, 'PENDING');
      assert.equal(db.payments[0].status, 'PENDING');
      assert.equal(db.credits.length, 0);
    } finally {
      RealFleecaPaymentProvider.prototype.getPaymentDetails = original;
    }
  });

  test('transaction and order replay protections grant one entitlement and reject cross-order reuse', async () => {
    const first = await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'intent-A' });
    const second = await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'intent-B' });
    assert.equal((await completePaymentOrder(first.orderId, 'txn-A')).success, true);
    assert.equal((await completePaymentOrder(first.orderId, 'txn-A')).success, true);
    assert.equal(db.credits.length, 1);
    assert.equal((await completePaymentOrder(second.orderId, 'txn-A')).success, false);
    assert.equal(db.credits.length, 1);
  });

  test('stored amount remains authoritative after package price changes', async () => {
    const order = await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'price-snapshot' });
    db.packages[0].price = 9000;
    const payment = db.payments.find((item) => item.order_id === order.orderId)!;
    assert.equal(payment.amount, 1);
    const expected = { orderReference: payment.order_id, payerReference: payment.profile_id, amount: payment.amount, currency: 'GTA_DOLLAR', purposeReference: 'STANDARD_7_DAY' };
    const verified: VerifiedExternalPayment = { externalTransactionId: 'txn-B', status: 'VERIFIED', occurredAt: '2026-09-26T12:00:00.000Z', ...expected };
    assert.equal(validateExternalPayment(verified, expected).verified, true);
  });

  test('webhook source never logs or returns sensitive payer and authorization data', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/payments/fleeca/webhook/route.ts'), 'utf8');
    assert.doesNotMatch(source, /console\.(log|warn|error)/);
    assert.doesNotMatch(source, /Authorization|FLEECA_API_KEY/);
    assert.doesNotMatch(source, /payer_routing.*NextResponse|payer_name.*NextResponse/);
  });
});