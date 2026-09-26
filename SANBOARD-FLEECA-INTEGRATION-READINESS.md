# SANBOARD — Fleeca Integration Readiness

Date: 2026-09-26

## 1. Current architecture

The intended canonical chain is:

`signed active character → Sanboard payment order → Fleeca provider transport → VerifiedExternalPayment → validateExternalPayment() → canonical ownership/amount/purpose checks → complete_sanboard_payment() → entitlement exactly once`

The official Fleeca transport is deliberately absent. `RealFleecaPaymentProvider` is a fail-closed boundary and throws `FLEECA_PROVIDER_NOT_CONFIGURED`; it contains no guessed URL, authentication, payload, status mapping, webhook signature, polling, retry, expiry, or refund behavior.

## 2. Canonical payment order

- `POST /api/checkout` resolves the actor with `resolveOwnedActiveProfile()`.
- Canonical order creation is provider-neutral; transport orchestration occurs in the checkout integration route rather than the payment repository/business helper.
- Client `profileId`, `userId`, and payer fields do not select the payment owner.
- Package, entitlement type, corporate target, and price are resolved server-side.
- `payments.order_id` is the Sanboard order identity.
- `payments.external_payment_id` is the final provider transaction identity and is not interchangeable with `order_id`.
- `payments.amount` is the authoritative order-time price snapshot. Later package price changes do not reprice an existing order.

## 3. Provider boundary

`FleecaPaymentProvider` is intentionally narrow:

- create an external order if the official contract requires it;
- retrieve an external order if the official contract requires it;
- verify a transaction and return `VerifiedExternalPayment`.

Normal checkout always selects `RealFleecaPaymentProvider`. The mock provider is available only through the explicit `getTestFleecaPaymentProvider()` gate, requires `ENABLE_TEST_PAYMENTS=true`, and is denied when `NODE_ENV=production`.

## 4. Verified payment contract

The provider adapter must translate official raw data into the provider-neutral `VerifiedExternalPayment` DTO. Business and entitlement code must not know raw Fleeca payload fields or provider status names.

The current canonical validation can reject:

- pending or failed results;
- wrong Sanboard order reference;
- wrong amount;
- wrong payer reference;
- wrong currency context;
- wrong purpose/package reference.

Whether Fleeca exposes reliable payer, currency, or purpose fields is unknown. The production adapter must not be implemented until the official contract determines which checks are supported and how they map. `GTA_DOLLAR` is currently an internal/test expectation label, not a claim about an official Fleeca field.

## 5. Ownership and amount authority

Interactive checkout ownership comes only from the signed canonical active profile. A future callback/webhook/polling handler must resolve the existing payment by trusted order/reference data and use the stored `payments.profile_id`; callback input must not choose a profile.

The external verified amount is compared with stored `payments.amount`. Completion does not compare against a later `packages.price`.

## 6. Replay and idempotency

- `(profile_id, idempotency_key)` prevents duplicate Sanboard order creation for one intent.
- `external_payment_id` uniqueness prevents one provider transaction from funding another order.
- A completed order rejects a different transaction ID.
- `entitlement_applied_at`, payment-row locking/RPC behavior, and one-credit-per-payment protection make completion replay idempotent.

## 7. Fail-closed behavior

When the real provider is not configured:

- checkout returns a safe `provider_not_configured` response;
- a canonical order may remain `PENDING` for audit/retry;
- no external transaction ID is invented;
- payment is not marked `SUCCESS`;
- no listing credit, subscription, or other entitlement is applied;
- no mock provider fallback occurs.

The payment page no longer exposes success/failure simulation controls. Browser query/body values such as `success=true`, `paid=true`, or a former `simulateSuccess` value are not authoritative.

## 8. Transport-neutral completion

Fleeca may ultimately use a browser callback, signed webhook, polling, or server lookup. Any supported transport must:

1. authenticate/verify the provider input using the official contract;
2. retrieve or derive a trusted external transaction;
3. adapt it to `VerifiedExternalPayment`;
4. run `validateExternalPayment()` against the stored payment row;
5. call the existing idempotent completion repository/RPC only after validation.

No webhook route exists. It must remain absent/disabled until official signature verification is available. Unsigned input cannot reach completion.

## 9. Refund, reversal, expiry, and currency

- Refund/reversal/chargeback support: **UNKNOWN — official Fleeca contract required**.
- Provider order expiry: **UNKNOWN — official Fleeca contract required**.
- Provider currency field and units: **UNKNOWN — official Fleeca contract required**.
- Payer identity and its relation to GTA World account/character/bank identity: **UNKNOWN — official Fleeca contract required**.

The current schema has no refund/reversal state or provider event ledger. A future schema proposal may be required after the official contract is known; no migration is introduced here.

## 10. Exact implementation files when official docs arrive

Primary implementation points:

- `src/lib/integrations/fleeca/real-provider.ts`
- `src/lib/integrations/fleeca/provider.ts` only if the official transport proves a method is unnecessary or requires a provider-neutral input change
- `src/lib/integrations/fleeca/types.ts` only for evidence-backed optional canonical fields
- `src/lib/integrations/fleeca/index.ts`
- `src/app/api/checkout/route.ts`
- a new callback/webhook/polling route only for the officially documented transport
- `.env.example` with only officially confirmed secret/configuration names
- `tests/fleeca-provider-boundary-readiness.test.ts`
- this readiness document and `SANBOARD-FLEECA-INTEGRATION-CONTRACT-REQUIRED.md`

## 11. What should not need changing

Provided the real adapter emits the canonical verified DTO, these layers should remain unchanged:

- `resolveOwnedActiveProfile()` actor resolution;
- payment repository order creation and `payments.profile_id` ownership;
- `payments.amount` snapshot rule;
- `validateExternalPayment()` canonical comparison logic, except optionality proven by the official contract;
- `complete_sanboard_payment()` and memory completion semantics;
- listing-credit and corporate-subscription entitlement rules;
- `external_payment_id`, idempotency, row-locking, and `entitlement_applied_at` replay protections;
- atomic boost logic, package prices, subscription periods, GTA World integration, and admin features.