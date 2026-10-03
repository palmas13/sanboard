import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getPaymentPrice } from '@/lib/payments/pricing';
import { parseFleecaCreateResponse, parseFleecaPaymentDetails } from '@/lib/integrations/fleeca/real-provider';

describe('Fleeca V2 hosted payment contract', () => {
  test('uses canonical product prices', () => {
    assert.equal(getPaymentPrice('LISTING_PUBLICATION'), 1500);
    assert.equal(getPaymentPrice('LISTING_BOOST'), 1000);
    assert.equal(getPaymentPrice('CORPORATE_SUBSCRIPTION'), 5500);
  });

  test('strictly accepts the authoritative HTTP 201 create response', () => {
    const fixture = { success: true, payment_id: '315d0895-095f-4aaa-aff3-1e5dbc05ea34', payment_link: 'https://banking-tr.gta.world/gateway/315d0895-095f-4aaa-aff3-1e5dbc05ea34', message: 'Payment created successfully' };
    assert.deepEqual(parseFleecaCreateResponse(fixture, 201), fixture);
    assert.equal(parseFleecaCreateResponse(fixture, 200), null);
    assert.equal(parseFleecaCreateResponse({ ...fixture, payment_link: 'https://evil.example/gateway/x' }, 201), null);
    assert.equal(parseFleecaCreateResponse({ ...fixture, payment_id: 'not-a-uuid' }, 201), null);
  });

  test('parses pending and successful details without using payer metadata', () => {
    const base = { merchant_id: 49, amount: 1, description: 'Order #2002', mode: 'sandbox', created_at: '2026-09-29T21:05:12.000000Z', updated_at: '2026-09-29T21:05:12.000000Z' };
    const pending = { success: true, data: { ...base, payment_id: '8ee1b66c-a92e-49a7-87ea-e008cdbd1545', status: 'awaiting_payment', payer_routing: null, payer_name: null, paid_at: null } };
    const paid = { success: true, data: { ...base, payment_id: '315d0895-095f-4aaa-aff3-1e5dbc05ea34', status: 'payment_successful', payer_routing: 10078525, payer_name: 'Provider Metadata', paid_at: '2026-09-29T21:02:10.000000Z' } };
    assert.deepEqual(parseFleecaPaymentDetails(pending), pending);
    assert.deepEqual(parseFleecaPaymentDetails(paid), paid);
    assert.equal(parseFleecaPaymentDetails({ ...paid, data: { ...paid.data, amount: 0.01 } }), null);
  });
});