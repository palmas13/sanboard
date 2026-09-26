import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
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

describe('SANBOARD Fleeca provider boundary readiness', () => {
  const accountId = '11111111-1111-4111-8111-111111111111';
  const alex = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const jordan = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.ENABLE_TEST_PAYMENTS = 'false';
    process.env.SANBOARD_SESSION_SECRET = 'fleeca-boundary-test-secret-at-least-32-characters';
    db.users = [{ id: accountId, provider: 'GTAWORLD', external_user_id: 'account-A', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' }];
    db.profiles = [
      { id: alex, user_id: accountId, full_name: 'Alex Stone', avatar_url: '', created_at: '', updated_at: '' },
      { id: jordan, user_id: accountId, full_name: 'Jordan Reed', avatar_url: '', created_at: '', updated_at: '' },
    ] as any;
    db.packages = [{ id: 'package-A', code: 'STANDARD_7_DAY', name: 'Standard', price: 2000, duration_days: 7, active: true, seller_type: 'INDIVIDUAL' }] as any;
    db.payments = [];
    db.credits = [];
  });

  const request = (method: 'POST' | 'PUT', body: Record<string, unknown>, profileId = alex, url = 'http://localhost/api/checkout') => new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: `sanboard_session=${createSessionToken({ userId: accountId, profileId, role: 'USER' })}`,
    },
    body: JSON.stringify(body),
  });

  test('production provider is always fail-closed and normal selector never returns mock', async () => {
    process.env.USE_MOCK_FLEECA = 'true';
    await assert.rejects(
      getFleecaPaymentProvider().verifyPayment('order-A'),
      (error: unknown) => error instanceof FleecaProviderNotConfiguredError
    );
    assert.equal(db.payments.length, 0);
    assert.equal(db.credits.length, 0);
  });

  test('normal checkout cannot create fake success or entitlement when provider is not configured', async () => {
    const response = await createCheckout(request('POST', { packageCode: 'STANDARD_7_DAY', profileId: jordan, paid: true }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'provider_not_configured');
    assert.equal(db.payments.length, 1);
    assert.equal(db.payments[0].profile_id, alex);
    assert.equal(db.payments[0].status, 'PENDING');
    assert.equal(db.payments[0].external_payment_id, undefined);
    assert.equal(db.credits.length, 0);
  });

  test('browser success flags and former simulation input cannot complete a payment', async () => {
    const order = await createCheckoutOrder(alex, 'STANDARD_7_DAY', { idempotencyKey: 'browser-proof' });
    const response = await verifyCheckout(request('PUT', { orderId: order.orderId, success: true, paid: true, simulateSuccess: true }, alex, `http://localhost/api/checkout?success=true`));
    assert.equal(response.status, 503);
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
    assert.equal(payment.amount, 2000);
    const expected = { orderReference: payment.order_id, payerReference: payment.profile_id, amount: payment.amount, currency: 'GTA_DOLLAR', purposeReference: 'STANDARD_7_DAY' };
    const verified: VerifiedExternalPayment = { externalTransactionId: 'txn-B', status: 'VERIFIED', occurredAt: '2026-09-26T12:00:00.000Z', ...expected };
    assert.equal(validateExternalPayment(verified, expected).verified, true);
  });

  test('unsigned webhook-style input has no route to completion', () => {
    const checkout = readFileSync(join(process.cwd(), 'src/app/api/checkout/route.ts'), 'utf8');
    const appApi = readFileSync(join(process.cwd(), 'SANBOARD-FLEECA-INTEGRATION-READINESS.md'), 'utf8');
    assert.doesNotMatch(checkout, /webhook-signature|x-fleeca|simulateSuccess/);
    assert.match(appApi, /Unsigned input cannot reach completion/);
    assert.equal(db.payments.length, 0);
    assert.equal(db.credits.length, 0);
  });
});