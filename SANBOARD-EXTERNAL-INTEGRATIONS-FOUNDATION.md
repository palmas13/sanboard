# SANBOARD External Integrations Foundation

Date: 2026-09-26
Scope: GTA World UCP/OAuth/API and Fleeca Bank readiness package 1
Out of scope: admin-character correction, production database changes, migrations, real endpoint invention, deployment, commit/push.

## Direct answers

1. **Which files must change when the real GTA World contract arrives?** Primarily `src/lib/integrations/gtaworld/real-provider.ts`, its raw transport types in `types.ts`, environment configuration, and GTA OAuth contract tests. If the confirmed authorization/token/state behavior differs, the two GTA auth route handlers also change. Sync, sessions, favorites, listings, and other business features should not need raw API field changes.
2. **Is business logic sufficiently separated from raw GTA World data?** It is materially improved: callback and sync now consume `ExternalGameAccount`, not `user.id`, `character`, `firstname`, or `lastname`. Remaining coupling exists in legacy UI naming (`GtaWorldCharacter`), the character-list route, OAuth orchestration, and mock aliases in memory-only repositories.
3. **What is required from real GTA World documentation?** Exact authorization/token/account URLs, HTTP methods/content types, required parameters, scopes, state behavior, raw account/character schema, ID scope/stability, avatar support, token expiry/refresh/revoke behavior, error/rate-limit behavior, and character removal semantics.
4. **Is an unknown GTAW account/character ready for the canonical system?** Yes for canonical sync and character-scoped local business logic. Opaque numeric, alphanumeric, prefixed, and UUID-looking external IDs are accepted. Generic account, three-character, rename, and later-character contracts are tested.
5. **Which features should work after a correct real adapter is connected?** Public browsing/detail, character selection/switch, favorite/unfavorite, corporate follow, listing creation/edit/republish where existing local eligibility and credit requirements are met, notifications, tickets, and corporate applications. These operate on canonical `users.id` / `character_profiles.id` after login sync.
6. **Which application blockers remain?** Payment/credit history actor authorization, unsigned routing-cookie fallbacks in some routes, boost atomicity/expiry enforcement, a narrow canonical character-list DTO, fixture aliases in memory repositories, OAuth redirect/state hardening, and zero-character/removed-character product behavior.
7. **How ready is payment architecture for Fleeca?** Internal package price authority, payment rows, entitlement selection, and Phase 1 completion idempotency are useful foundations. Live integration remains blocked by the missing real provider contract, server-confirmed verification mechanism, callback/polling decision, and reconciliation model.
8. **What is required from Fleeca documentation?** Authentication, order creation and lookup/verification operations, callback or polling model, signature rules, transaction/order/payer references, amount unit and currency semantics, statuses, timestamps, idempotency behavior, expiry, error/rate-limit/retry rules, and refund/reversal behavior.
9. **Is verification/idempotency sufficient?** Package price and entitlement completion are server-side; duplicate order completion and duplicate external transaction protections exist in Phase 1. It is not sufficient for production until provider-confirmed amount, payer, purpose, status, and transaction identity are supplied and verified. This package adds that canonical verification contract but not an invented real transport.
10. **Is a DB migration required now?** No migration was created. Current schema already has provider, external payment ID, status, amount, order, idempotency, and entitlement fields. A provider-event/attempt ledger may be required after the official callback/polling contract is known; see DB CHANGE PROPOSAL.
11. **Was production DB touched?** No. No SQL, migration, Supabase push, or database command was run.
12. **Was admin character excluded?** Yes. No name-based admin, fixture override, or admin bypass was added.
13. **Test/build result?** See Final validation. Baseline tests were 253/253. The new targeted contract suite adds 7 tests.

## 1. Architecture summary

Target authentication flow:

```text
GTA World raw response
  -> Real/Mock GTA World provider adapter
  -> ExternalGameAccount
  -> ExternalGameCharacter[]
  -> users / character_profiles
  -> signed active-character session
  -> Sanboard business logic using canonical UUIDs
```

Target payment flow:

```text
Sanboard paid action
  -> server-authoritative package/order
  -> Fleeca provider
  -> VerifiedExternalPayment
  -> expectation validation (order/payer/amount/currency/purpose/status)
  -> existing idempotent payment completion
  -> Sanboard entitlement
```

GTA World is a login/sync dependency, not a dependency of every page request. Fleeca is a payment-only dependency. Public content remains served from Sanboard storage.

## 2. GTA World current implementation

### CURRENT GTA WORLD COUPLING MAP

| Layer | Current responsibility | Coupling/status |
|---|---|---|
| `src/app/api/auth/gtaworld/login/route.ts` | Starts mock callback or real OAuth redirect; creates attempt/state cookie | OAuth orchestration is provider-aware. Redirect allowlisting and signed attempt state remain hardening work. |
| `src/app/api/auth/gtaworld/callback/route.ts` | State/code handling, transient token exchange, canonical sync, session/cookie creation | Now consumes `ExternalGameAccount`; no raw account/character field access. |
| `src/lib/integrations/gtaworld/provider.ts` | Common OAuth/provider contract | `fetchAccount()` returns canonical integration DTO. Older login/session methods remain for compatibility and should later be removed. |
| `real-provider.ts` | Current assumed OAuth transport and raw response validation/adapter | Only file intended to know raw GTA World fields. URLs/fields are unconfirmed until official docs are supplied. |
| `mock-provider.ts` | Explicit local/test provider and named demo fixtures | Fixtures remain confined to mock code. It implements the same `fetchAccount()` contract. |
| `types.ts` | Raw transport types plus canonical integration DTOs/adapter | Raw and canonical types are visibly separated but remain in one small file to avoid file explosion. |
| `src/lib/auth/gtaworld-sync.ts` | Canonical account/profile upsert | Consumes provider-neutral account/character IDs and display names. External IDs remain opaque strings. |
| `src/app/api/user/characters/route.ts` | Lists synchronized local profiles | Does not call GTA World, which is correct. It still exposes raw profile rows and GTA-named UI types. |
| `src/app/api/auth/session/route.ts` | Selects/switches canonical profile and signs session | Provider-independent; verifies profile ownership and account status. |
| `src/lib/auth/session.ts` | HMAC session and character-selection token | Contains only canonical Sanboard IDs; no access token is stored. |
| `AuthContext.tsx` | Client hydration/switch UX | Uses local APIs only, but `GtaWorldCharacter` naming is legacy coupling. |

### Confirmed behavior

- Mock auth is enabled only by `USE_MOCK_GTAWORLD_AUTH=true`.
- The OAuth access token is transient and is neither placed in the Sanboard session nor persisted by this code.
- Sanboard role is created as `USER`; provider role fields do not grant Sanboard admin.
- Sync preserves existing canonical profile UUIDs across rename and later character additions.
- Missing characters in a later upstream snapshot are not deleted.
- After synchronization, normal feature requests read local repositories instead of GTA World.

### Assumed or unconfirmed behavior

- The current default base URL and `/oauth/authorize`, `/oauth/token`, `/api/user` paths.
- Empty scope behavior.
- Raw `user`, `character`, `firstname`, and `lastname` field names.
- Whether OAuth state is returned and under which conditions.
- Whether character IDs are globally unique or only account-scoped.
- Whether missing characters mean deletion, transfer, temporary omission, or filtering.

## 3. GTA World provider boundary

`GtaWorldAuthProvider.fetchAccount()` is the application boundary. The real provider owns transport parsing and calls `adaptGtaWorldApiUser()`. Application sync sees only:

```ts
interface ExternalGameAccount {
  externalAccountId: string;
  characters: ExternalGameCharacter[];
}
```

No application feature should import raw GTA World response types. The deprecated `fetchUser()` methods exist only on concrete providers for current regression-test compatibility and are not in the common provider interface.

## 4. Canonical account contract

`externalAccountId` is a non-empty opaque string. Sanboard does not infer numeric, UUID, provider role, or account type semantics from its shape. It maps to `users.external_user_id`; `users.id` remains the canonical internal identity.

## 5. Canonical character contract

```ts
interface ExternalGameCharacter {
  externalCharacterId: string;
  displayName: string;
  avatarUrl?: string | null;
}
```

`externalCharacterId` is opaque. `character_profiles.id` remains the actor ID used by favorite, follow, listing, payment, ticket, notification, and corporate logic. Provider roles are deliberately absent.

## 6. GTA WORLD DOCUMENTATION NEEDED

- Authorization URL and required query parameters.
- Token URL, method, body encoding, and authentication style.
- Redirect URI registration and exact matching requirements.
- Whether `state` is accepted and always echoed; error behavior when absent/invalid.
- Required/optional scopes and consent behavior.
- Account endpoint and character-list source.
- Raw account ID and character ID fields; nullability and ID stability/scope.
- Name/display-name fields and rename behavior.
- Avatar URL/reference availability and authorization requirements.
- Access-token lifetime and token type.
- Refresh-token availability, rotation, expiry, and storage requirements.
- Revoke/logout behavior.
- Account/character disabled, banned, deleted, or transferred semantics.
- Pagination, rate limits, retries, timeouts, and error response contract.

No answer is assumed by this foundation.

## 7. Fleeca current payment architecture

- `POST /api/checkout` derives the actor from the signed session and resolves corporate ownership/eligibility server-side.
- Package and amount are loaded server-side; browser-supplied price is not authoritative.
- `payments` stores order, profile, package, provider, amount, status, external payment ID, idempotency key, corporate target, entitlement type, and applied timestamp where the Phase 1 migration is present.
- Supabase completion uses `complete_sanboard_payment`, which locks the payment, validates the package/entitlement, protects external transaction reuse, and applies the entitlement transactionally.
- Memory completion has matching replay behavior for tests/local development.
- Direct subscription activation is disabled; subscription activation is payment-gated.
- Real Fleeca transport is intentionally unimplemented. No endpoint, payload, webhook, or signature was invented.

Known gaps:

- `PUT /api/checkout` is a mock-oriented browser-triggered completion path and must not become the live trust boundary.
- `src/app/api/credits/route.ts` and `src/app/api/user/payments/route.ts` accept caller-selected profile IDs without signed-session ownership checks: **APPLICATION BLOCKED** for sensitive production exposure.
- Boost consumption requires an atomic repository/DB operation and explicit expiry enforcement: **APPLICATION BLOCKED**.
- Provider order creation after local payment creation needs reconciliation/retry semantics.

## 8. Fleeca provider boundary

The provider owns external transport only:

- create an external payment/order if the official contract requires it;
- fetch/verify an external transaction;
- translate raw fields into `VerifiedExternalPayment`.

Sanboard retains package selection, price authority, actor/store eligibility, replay checks, and entitlement rules. Mock Fleeca requires `USE_MOCK_FLEECA=true` in production/Supabase configuration. Existing non-production, non-Supabase local/test execution retains its mock default. Supabase or production configuration with a missing mock flag selects the real, fail-closed placeholder instead of silently simulating payment.

## 9. Verified payment contract

The canonical result contains:

- `externalTransactionId`
- `status`: `VERIFIED | PENDING | FAILED`
- `orderReference`
- `payerReference`
- `amount`
- `currency`
- `purposeReference`
- `occurredAt`

`validateExternalPayment()` rejects pending, failed, wrong order, wrong amount, wrong payer, wrong currency, and wrong purpose before the existing completion/entitlement layer is invoked. `payerReference` is external-provider verification context; it is not assumed to equal a GTA World external character ID.

`GTA_DOLLAR` is an internal Sanboard context label used by the mock contract, not a claim about an official Fleeca raw field or ISO currency. It must be mapped only after official documentation confirms the money model.

## 10. Payment security and idempotency

Canonical rule: a client statement that payment succeeded grants nothing. Live fulfillment must be driven by a server-to-server lookup or authenticated provider notification.

Required checks:

1. Resolve the local payment and expected package from Sanboard.
2. Verify external transaction server-side.
3. Match order reference, payer reference, amount, currency context, and purpose/package.
4. Require `VERIFIED`; do not fulfill `PENDING` or `FAILED`.
5. Reject a reused external transaction.
6. Execute the existing idempotent entitlement completion once.

Existing Phase 1 protection includes profile/idempotency uniqueness, external payment ID uniqueness, one credit per payment, row locking, and repeat completion convergence. Production readiness depends on confirming that the migration is deployed; this task did not query or change production.

## 11. New-character feature readiness matrix

| Feature | Ready? | Blocker / note |
|---|---:|---|
| Browse listings | READY | Public local DB path; no external call required. |
| Listing detail | READY | Local DB. Personalized overlays should continue to use signed session. |
| Favorite | READY | Canonical profile-scoped flow is covered by existing tests. |
| Unfavorite | READY | Same canonical profile-scoped flow. |
| Corporate follow | READY | Uses canonical follower profile/store IDs after session. |
| Create listing | READY WITH LOCAL ENTITLEMENT | Actor is canonical profile; paid credit purchase is integration-blocked until live Fleeca verification. |
| Edit own listing | READY | Existing ownership rules use local canonical profile. |
| Republish | READY WITH LOCAL ENTITLEMENT | Republish logic works; obtaining a new paid credit is integration-blocked. |
| Buy listing credit | INTEGRATION BLOCKED | Official Fleeca verification/callback or polling contract missing. |
| Boost listing | APPLICATION BLOCKED | Atomic consumption and subscription-expiry enforcement need correction; paid acquisition also needs Fleeca. |
| Notifications | READY / HARDENING NEEDED | Local feature; some routes still contain unsigned cookie fallback. |
| Ticket | READY | Local canonical profile ownership. |
| Corporate application | READY | Local canonical profile. Product approval rules remain unchanged. |
| Corporate subscription | INTEGRATION BLOCKED | Entitlement logic exists; live verified payment transport is missing. |
| Character switch | READY | Signed session uses canonical profile UUID and verifies ownership. |
| Zero-character account | PRODUCT DECISION | Login can sync an empty list; desired UX/account state is not specified. |
| Removed/transferred character | PRODUCT DECISION | Sync intentionally does not delete missing profiles; lifecycle policy is unspecified. |

## 12. Environment and secrets

Current server-only categories:

- `GTAWORLD_API_BASE_URL`
- `GTAWORLD_CLIENT_ID`
- `GTAWORLD_CLIENT_SECRET`
- `GTAWORLD_REDIRECT_URI`
- `GTAWORLD_OAUTH_STATE_SUPPORT` (temporary verification gate)
- `FLEECA_API_BASE_URL`
- `FLEECA_MERCHANT_ID`
- `FLEECA_API_KEY`
- `FLEECA_WEBHOOK_SECRET`
- `SANBOARD_SESSION_SECRET`

Server secrets must not use `NEXT_PUBLIC_`, enter client bundles, appear in query strings, or be logged. Raw access/refresh/bank tokens and sensitive provider payloads must be redacted. Exact Fleeca secret names and webhook use remain placeholders until official documentation is known.

## 13. Failure and retry model

- GTA login/token/account fetch failure: fail login with a generic user-facing error and a structured server category; do not expose upstream payloads or credentials.
- Existing authenticated browsing: continue from local Sanboard session/DB; do not call GTA World per request.
- Character sync failure: do not create a partial signed active-character session.
- Fleeca unavailable/unverifiable: keep payment pending, grant no entitlement, and allow safe retry/reconciliation.
- Duplicate callback/poll result: converge through external transaction and entitlement idempotency.
- Mismatch: classify as order/amount/payer/currency/purpose mismatch and grant nothing.

Recommended structured categories: `GTAW_AUTH_FAILURE`, `GTAW_ACCOUNT_FETCH_FAILURE`, `GTAW_CHARACTER_SYNC_FAILURE`, `FLEECA_VERIFICATION_FAILURE`, `FLEECA_UNAVAILABLE`, `PAYMENT_MISMATCH`, and `PAYMENT_REPLAY`. Logs should contain local correlation/order IDs and categories, never secrets or full sensitive payloads.

## 14. Performance boundaries

- Public pages, favorite, follow, listing detail, homepage, notifications, and ordinary authenticated requests use Sanboard repositories only.
- GTA World is called during OAuth login/account synchronization, with future revalidation policy to be decided separately.
- Fleeca is called only in payment creation/verification/reconciliation flows.
- No design should introduce `request -> GTA World -> Fleeca -> DB` for ordinary page requests.

## 15. Integration blockers

### GTA World

- Official transport/schema/state contract not supplied.
- OAuth redirect target validation and signed attempt-state hardening remain application security work.
- Character ID scope and missing-character lifecycle are not confirmed.
- Character-list API/UI type remains GTA-named and overexposes persistence rows.

### Fleeca

- Official API/auth/verification and callback/polling contract not supplied.
- Real provider is a safe placeholder.
- Browser-triggered mock completion cannot be used as production proof.
- Credit/payment history routes require actor authorization fixes.
- Boost consumption requires atomicity and expiry hardening.
- Reconciliation/event persistence design depends on the real contract.

### DB CHANGE PROPOSAL

No migration is justified from assumptions alone. The current `payments` schema can store a single provider transaction and protect entitlement replay. After official Fleeca documentation, propose a migration only if required for:

- provider notification/event identity and raw-event hash/status;
- multiple verification attempts and last error/retry timestamps;
- provider-order identity distinct from final transaction identity;
- refunds/reversals;
- provider-scoped transaction uniqueness if more than one payment provider is introduced;
- atomic boost consumption RPC.

Exact columns and constraints must follow confirmed provider semantics. No migration was created or run in this package.

## 16. Next implementation steps

1. Obtain and review official GTA World OAuth/API documentation.
2. Replace only the real provider transport/raw adapter assumptions and update contract tests.
3. Harden local redirects, state/attempt signing, and zero-character UX.
4. Introduce a provider-neutral character summary DTO and remove raw profile exposure/mode flags from the character API.
5. Obtain official Fleeca API/security documentation and decide callback vs polling vs both.
6. Implement real Fleeca adapter and authenticated server verification without exposing secrets.
7. Fix credits/payment-history actor authorization before live payments.
8. Add reconciliation/event persistence only if confirmed contract needs it.
9. Make boost entitlement consumption atomic and expiry-aware.
10. Run staging smoke tests with a genuinely unknown account and multiple characters; admin-character behavior remains a separate task.

## Final validation

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 260/260 tests across 48 suites.
- `npm run build`: passed with Next.js 16.3.6; 52/52 static pages generated.
- `git diff --check`: passed (only Git line-ending conversion warnings were printed).
- Production DB/SQL/migrations/Supabase push: not run.
- Commit/push: not run.
