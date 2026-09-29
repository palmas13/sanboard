# SANBOARD — Fleeca Integration Contract Required

Date: 2026-09-26

No real Fleeca transport may be enabled until the official contract answers every applicable item below. No endpoint, credential, payload, status, signature, expiry, retry, or refund behavior may be inferred.

| # | Required official information | Current answer |
|---:|---|---|
| 1 | API base URL | UNKNOWN — official Fleeca contract required |
| 2 | Authentication method | UNKNOWN — official Fleeca contract required |
| 3 | API credential format | UNKNOWN — official Fleeca contract required |
| 4 | Payment/order creation endpoint | UNKNOWN — official Fleeca contract required |
| 5 | Required request fields | UNKNOWN — official Fleeca contract required |
| 6 | Provider order ID semantics | UNKNOWN — official Fleeca contract required |
| 7 | Transaction lookup endpoint | UNKNOWN — official Fleeca contract required |
| 8 | Transaction ID semantics | UNKNOWN — official Fleeca contract required |
| 9 | Transaction ID uniqueness guarantee | UNKNOWN — official Fleeca contract required |
| 10 | Payment status values | UNKNOWN — official Fleeca contract required |
| 11 | Final/settled status | UNKNOWN — official Fleeca contract required |
| 12 | Failed/cancelled statuses | `payment_failed` is a terminal failure; no fulfillment |
| 13 | Pending status behavior | `pending` callback performs no fulfillment |
| 14 | Amount field format and units | UNKNOWN — official Fleeca contract required |
| 15 | Currency behavior | UNKNOWN — official Fleeca contract required |
| 16 | Payer identity field | UNKNOWN — official Fleeca contract required |
| 17 | Character/account/bank-account relationship | UNKNOWN — official Fleeca contract required |
| 18 | Order/reference/purpose field | UNKNOWN — official Fleeca contract required |
| 19 | Browser callback mechanism | Redirect URI receives `payment_id=<uuid>` as correlation only |
| 20 | Webhook availability | POST callback confirmed |
| 21 | Webhook signature verification | `X-Fleeca-Signature: sha256=<HMAC-SHA256(raw body, FLEECA_API_KEY)>` |
| 22 | Webhook event ID | UNKNOWN — official Fleeca contract required |
| 23 | Event replay semantics | UNKNOWN — official Fleeca contract required |
| 24 | Polling support | UNKNOWN — official Fleeca contract required |
| 25 | Payment/order expiry | UNKNOWN — official Fleeca contract required |
| 26 | Retry behavior | UNKNOWN — official Fleeca contract required |
| 27 | Rate limits | UNKNOWN — official Fleeca contract required |
| 28 | Error response format | UNKNOWN — official Fleeca contract required |
| 29 | Refund support | UNKNOWN — official Fleeca contract required |
| 30 | Reversal/chargeback support | UNKNOWN — official Fleeca contract required |
| 31 | Refund/reversal webhook or event behavior | UNKNOWN — official Fleeca contract required |
| 32 | Sandbox/test environment | UNKNOWN — official Fleeca contract required |
| 33 | Provider idempotency support | UNKNOWN — official Fleeca contract required |
| 34 | Timestamp and timezone semantics | UNKNOWN — official Fleeca contract required |
| 35 | Provider maintenance/outage behavior | UNKNOWN — official Fleeca contract required |

## Mandatory security gate

- The webhook route verifies the official raw-body HMAC contract with timing-safe comparison before payload parsing.
- Unsigned or unverifiable events must never produce `VerifiedExternalPayment`, mark a payment `SUCCESS`, or apply an entitlement.
- Browser redirects and query/body fields are navigation context only. They are never payment proof.
- Provider transaction identity must come from trusted server-side verification, not the browser.

## Potential future schema blockers

No migration is required by this readiness package. After the official contract arrives, a migration may be proposed for a provider-order ID distinct from the final transaction ID, webhook event ledger/event ID, verification attempt history, or refund/reversal state. None is invented now.