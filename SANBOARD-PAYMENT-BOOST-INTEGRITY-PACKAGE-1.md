# SANBOARD — Payment / Boost Integrity Package 1

Date: 2026-09-26

## 1. Scope

This package is limited to atomic corporate boost consumption, server-authoritative subscription eligibility, early-renewal boost reset prevention, and payment-to-entitlement idempotency verification. It does not add a real Fleeca/GTA World endpoint, admin authorization, UI polish, removed-character lifecycle, or a new paid product.

## 2. Existing boost model

Boost rights are stored in `corporate_profiles.boost_credits`. Boost state is stored on `listings.is_featured` and `listings.featured_until`; the existing window is 24 hours. Before this package the Supabase repository read the store and listing, calculated `boost_credits - 1`, then independently updated the listing and store with `Promise.all`. This was neither atomic nor rollback-safe and allowed concurrent double-spend. No boost-history table exists.

Ownership previously accepted a client `dealerId` and a session/routing-cookie profile fallback. The route now resolves only `resolveOwnedActiveProfile()` and passes the canonical `character_profiles.id` to the repository. The client supplies only the resource identifier `listingId`.

## 3. Atomic boost before/after

Before: application-level SELECT/check followed by two independent UPDATE statements.

After: the proposed `SECURITY DEFINER` RPC `consume_corporate_boost(actor_profile_id, listing_id)` locks the actor-owned corporate store and target listing with `FOR UPDATE`, evaluates every eligibility condition, then decrements the credit and writes the boost window in one transaction. Failure returns before either mutation. Execution is revoked from `PUBLIC`, `anon`, and `authenticated`; only `service_role` receives execute permission.

Safe result codes are `NO_BOOST_CREDITS`, `SUBSCRIPTION_INACTIVE`, `SUBSCRIPTION_EXPIRED`, `LISTING_NOT_OWNED`, `LISTING_NOT_ELIGIBLE`, and `ALREADY_BOOSTED`. Raw database errors are not returned by the API.

## 4. Subscription eligibility

Boost requires all of the following server/DB facts: approved store, active moderation, exact actor ownership, corporate listing/store match, active listing, `subscription_status = 'ACTIVE'`, `subscription_expires_at > NOW()`, and positive credits. `ACTIVE` with an expired timestamp is rejected. A non-active status with future expiry is also rejected rather than silently reconciled.

Expiry does not remove the public store or retroactively deboost an existing listing. It only blocks new paid corporate actions, preserving the existing product rule.

## 5. Early renewal abuse before/after

Before: every distinct successful subscription payment extended expiry and assigned `boost_credits = 3`, so early renewal refreshed a depleted current period.

After: expiry still uses `GREATEST(NOW(), existing expiry) + 30 days`, but a payment resets credits only when the subscription is not currently active/unexpired or an initialized period has elapsed. A legacy active row with both period fields null is initialized without resetting credits. An early renewal extends total subscription time while preserving current-period credits, including zero. Replaying the same payment remains a no-op after `entitlement_applied_at` is set.

## 6. Subscription period model

The existing schema had no explicit period columns. The minimal proposal adds nullable `corporate_profiles.current_period_start` and `current_period_end`. It does not create invoices, schedules, ledgers, or a general billing engine.

Migration-time legacy initialization updates only active rows with a future subscription expiry and both period fields null. It sets a technical period start to the transaction-stable `NOW()` and period end to `LEAST(NOW() + 30 days, subscription_expires_at)` while preserving `boost_credits` exactly. Historical boundaries are not invented. When a genuinely new period begins, the completion transaction grants exactly three credits once. For an already prepaid subscription, the atomic boost RPC advances an elapsed initialized period at first use, caps its end at `subscription_expires_at`, and grants three once while holding the store row lock. Early renewal does not alter an initialized current period.

Both RPC and memory behavior are fail-safe for `boost_credits IS NULL`: no listing is featured and no nullable decrement is attempted. Repository history defines `boost_credits` as `INTEGER NOT NULL DEFAULT 3`; the preflight nevertheless reports deployed nullability and exact null/negative row counts rather than assuming production matches migration history.

## 7. Payment idempotency audit

The canonical chain remains expected server package/order → `VerifiedExternalPayment` → `validateExternalPayment()` → canonical payment row → `complete_sanboard_payment` → entitlement. At order creation the active package price must be positive and is copied into `payments.amount`; from that point `payments.amount` is the server-authoritative order-time price snapshot. External verification compares the provider amount to that stored snapshot, and completion does not compare it to a later live `packages.price`. Package existence/active state, code/type/duration, payment owner, entitlement type, and corporate target remain server authoritative at completion.

Existing protections retained and reverified: `(profile_id, idempotency_key)` uniqueness, `external_payment_id` uniqueness, one listing-credit row per `payment_id`, payment row `FOR UPDATE`, `entitlement_applied_at`, and provider-transaction conflict detection. Pending, failed, wrong amount, wrong payer/profile, wrong currency, and wrong purpose are rejected by the provider-independent validation boundary before entitlement completion.

## 8. Exactly-once entitlement

Subscription replay returns success without extending expiry twice. Listing-credit replay returns the existing single credit. A duplicate external transaction cannot fund a second payment. Checkout read/create/complete authorization now resolves the DB-fresh signed active character and cannot transfer another character's payment through a body profile ID.

No direct paid boost package exists and none was added. Boost remains an entitlement of the corporate subscription.

## 9. Migration/schema changes

Proposed, unapplied migration:

`supabase/migrations/20260926060000_payment_boost_integrity_package_1.sql`

It adds the two period columns, performs the deterministic active/future legacy period backfill described above without changing credits, adds and validates the nonnegative boost constraint, replaces `complete_sanboard_payment` with period-aware replay-safe behavior, and adds `consume_corporate_boost`. Constraint validation intentionally stops deployment if unresolved negative rows exist. Locked/applied migrations were not edited. The exact SQL is the complete content of that file; it has not been executed against production or any remote database.

## 10. Preflight

Read-only preflight:

`supabase/scripts/payment_boost_integrity_package_1_preflight.sql`

It is a true pre-migration script: proposed period-column presence is inspected through `information_schema.columns`, while corporate row queries use only the existing schema. It reports deployed `boost_credits` nullability/default, null and negative row counts, status/expiry health, payment duplicates, every relevant RPC overload/signature/definition/ACL, the exact expected Phase 1 uniqueness indexes and their deployed definitions, constraints, and the three package rows without inventing prices. It contains only `SELECT` statements.

Read-only postflight:

`supabase/scripts/payment_boost_integrity_package_1_postflight.sql`

It checks one-sided/null/invalid period pairs, period ends beyond subscription expiry, active future subscriptions left without a period, expired subscriptions with future periods, null/negative credits, constraint validation state, and final RPC signatures/ACLs. It contains only `SELECT` statements.

## 11. Regression tests

`tests/payment-boost-integrity-package-1.test.ts` covers active consumption, same-listing double click, different-listing concurrency with one credit, zero/null credits, expired/inactive subscription, cross-account actor injection, early renewal with initialized and legacy-null periods at one/zero credits, free-reset prevention, period-end capping at prepaid expiry, new-period reset exactly once, subscription replay, listing-credit replay, migration atomicity/ACLs, validated nonnegative constraint, and read-only preflight/postflight. Clocks use fixed UTC timestamps.

## 12. Remaining blockers

- The new migration must be reviewed with production preflight output and applied through the controlled deployment process before Supabase runtime receives the new RPC/columns.
- Production preflight output must confirm zero negative boost-credit rows before deployment; null rows, if any despite the historical `NOT NULL` definition, require an explicit data decision and are not rewritten by this package.
- Real Fleeca verification/callback contracts remain unavailable and out of scope.
- The older generic `consumeCredit` repository helper is still SELECT→UPDATE, but canonical create/republish flows already use transaction RPCs; removing or hardening the unused helper is a separate cleanup.

## 13. Next package

After controlled migration rollout, the recommended next payment package is Fleeca adapter/callback reconciliation using the existing `VerifiedExternalPayment` boundary. Admin authorization/moderation remains a separate isolation package.

## 14. Readiness matrix

| Feature | Atomic? | Character-scoped? | Subscription checked? | Payment idempotent? | Fleeca-ready? |
|---|---:|---:|---:|---:|---:|
| Listing credit purchase | Yes | Yes | Corporate variant: yes | Yes | Boundary-ready |
| Republish credit consumption | Yes (RPC) | Yes | Corporate variant: yes | N/A; consumes one credit | Boundary-ready |
| Corporate subscription purchase | Yes (RPC) | Yes | Eligibility checked | Yes | Boundary-ready |
| Corporate renewal | Yes (RPC) | Yes | Period-aware | Yes | Boundary-ready |
| Boost consume | Yes (new RPC) | Yes | Status + expiry | N/A; same-window safe | Boundary-ready after migration |