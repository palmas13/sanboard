# SANBOARD Backend Final Hardening

Date: 2026-09-27

## 1. Scope

This package completes the remaining normal-user backend hardening work without resetting the existing working tree. It covers canonical active-character authorization for corporate dashboard, account bootstrap, favorites, reports and profile onboarding; sibling-character listing ownership regression coverage; removal of the unused non-atomic `consumeCredit` repository API; atomic-only Supabase listing publication; and mock/provider consumer inventory.

No SQL, migration, production database operation, commit, or push was performed.

## 2. Canonical actor boundary

Normal-user private routes hardened in this package use:

`signed sanboard_session -> session.userId/session.profileId -> resolveOwnedActiveProfile() -> DB-fresh owned character_profiles row`

The writable `sanboard_profile_id`, `sanboard_user_id`, and `sanboard_role` cookies are not authorization inputs in the audited normal-user routes. Query/body profile identifiers are ignored or removed where they previously attempted to describe the actor.

## 3. Completed hardening

### Corporate dashboard

- `/api/dealers/profile` GET/PUT resolves the active character and its owned store.
- `/api/dealers/listings` resolves the active character's store before loading corporate listings.
- `/api/dealers/subscription/activate` validates the signed active character as store owner and retains the existing payment-only activation rule.
- The corporate dashboard client no longer sends `profileId` query parameters.

### Account bootstrap

- `/api/account/bootstrap` requires an owned active profile.
- Profile, personal listings, favorites, credits, corporate store and support counts are scoped to `character_profiles.id`.
- Sibling characters under one account are not aggregated.

### Favorites and reports

- `/api/user/favorites` reads only the signed active character's favorites.
- `/api/reports` derives `reporter_profile_id` from the signed active character.
- `ReportModal` no longer submits `reporterProfileId`.

### Profile onboarding and external identity trust

- `/api/user/profile` POST no longer creates a canonical character from client `characterId` or client `fullName`.
- It requires an already synchronized, owned active profile and updates only Sanboard-owned onboarding fields: avatar, SanMail and phone.
- GTA World external character identity remains owned by the provider sync boundary in `src/lib/auth/gtaworld-sync.ts`.
- Client attempts to inject another external ID or display name do not change canonical identity.

### Listing ownership

- `/api/user/listings/[id]` GET requires both repository ownership and `listing.seller_profile_id === actor.profileId`.
- PUT strips client actor-like fields and delegates with the canonical active profile.
- DELETE delegates with the canonical active profile.
- Executable tests verify that sibling-character GET, PUT and DELETE attempts are denied.

## 4. Credit publication atomicity

- `IPaymentRepository.consumeCredit()` and both memory/Supabase implementations were removed.
- Canonical listing creation uses `create_listing_with_credit`.
- Supabase listing creation no longer falls back to separate credit select/update, listing insert, detail insert and image insert operations when the RPC is unavailable.
- Any RPC error now fails closed before a listing or credit mutation is attempted.
- Republish continues to use `republish_listing_with_credit` without a non-atomic fallback.

Production readiness still depends on the already-defined atomic RPCs being present in the deployed database. This package did not apply or modify migrations.

## 5. Legacy cookie authority audit

### Removed/denied as actor authority

The audited normal-user private routes do not read `sanboard_profile_id`, `sanboard_user_id`, or `sanboard_role`:

- `/api/account/bootstrap`
- `/api/dealers/profile`
- `/api/dealers/listings`
- `/api/dealers/subscription/activate`
- `/api/reports`
- `/api/user/favorites`
- `/api/user/listings/[id]`
- `/api/user/profile`

Server-rendered listing detail and premium-store follow-state hydration were also changed to use the signed session rather than writable actor cookies.

### Retained non-authoritative uses

- Auth/session and test-login flows may set or clear legacy cookies as routing/UI compatibility hints.
- `sanboard_session` remains the signed HttpOnly authorization cookie.
- The signed character-selection context remains valid before a full active-character session exists.
- GTA World OAuth attempt/state cookies remain external callback security state, not character identity.

## 6. Regression coverage

`tests/backend-final-hardening-package-1.test.ts` uses generic identities:

- Account X: Alex Stone and Jordan Reed
- Account Y: Morgan Hale

Covered scenarios:

1. Corporate dashboard ignores query and legacy-cookie actor injection.
2. Account bootstrap returns only the active character's data.
3. Favorites ignore query and legacy-cookie actor injection.
4. Sibling-character private listing GET/PUT/DELETE are denied.
5. Profile onboarding ignores client external identity/name injection.
6. Reports use the signed active character and reject logged-out requests.
7. Audited normal-user routes contain no legacy actor-cookie reads.
8. Listing publication is atomic-only and `consumeCredit` is absent.

## 7. Mock and provider consumer inventory

### GTA World

- Normal login: `/api/auth/gtaworld/login` and callback use `RealGtaWorldAuthProvider`.
- Temporary test login: `/api/auth/test-login` directly constructs `MockGtaWorldAuthProvider` only when `ENABLE_TEST_LOGIN=true`.
- Test identities use reserved `test-login:*` namespaces and still synchronize to canonical users/profiles before session creation.
- Normal login does not fall back to mock.

### Fleeca

- Normal checkout uses `getFleecaPaymentProvider()`, which selects the real provider boundary.
- Mock Fleeca is available only from `getTestFleecaPaymentProvider()`.
- Test payments require `ENABLE_TEST_PAYMENTS=true` and are denied when `NODE_ENV=production`.
- Browser fields do not prove payment; checkout completion validates provider output before repository completion.

### Memory/demo data

- Named demo fixtures remain in memory/mock/test-only areas.
- They are not treated as production account or character identity.

## 8. Admin blockers (reported only)

Admin redesign was intentionally not performed.

- `/api/admin` permits either a DB-fresh active character with `role === ADMIN` or an internal `x-sanboard-secret` matching the Supabase secret key.
- `/api/admin/audit` uses account-level `users.role/status`, not the same active-character role contract.
- `getAdminActorProfileId()` can fall back to `SYSTEM_ADMIN` after a separate access check.
- Admin APIs are broad, monolithic and contain service-level behavior that requires a dedicated threat model and authorization package.

These differences are blockers for declaring the admin backend fully hardened, but they do not change the normal-user verdict below.

## 9. Readiness matrix

| Feature | Actor source | Character isolated? | Client actor injection possible? | Verdict |
|---|---|---:|---:|---|
| Character session/switch | Signed selection/session context + canonical ownership | Yes | No | READY |
| Account bootstrap | `resolveOwnedActiveProfile()` | Yes | No | READY |
| Favorites | `resolveOwnedActiveProfile()` | Yes | No | READY |
| Reports | `resolveOwnedActiveProfile()` | Yes | No | READY |
| Corporate profile/dashboard | `resolveOwnedActiveProfile()` | Yes | No | READY |
| Corporate listings dashboard | Active character -> owned store | Yes | No | READY |
| Corporate subscription activation request | Active character -> owned store | Yes | No | READY; payment-only activation retained |
| Profile read/update/onboarding | `resolveOwnedActiveProfile()` | Yes | No | READY |
| Private listing read/edit/delete | `resolveOwnedActiveProfile()` + seller ownership | Yes | No | READY |
| Listing create/republish credit consumption | Active character + atomic RPC | Yes | No | READY IN CODE; deployed RPC required |
| Checkout/payment completion | Active character + provider verification | Yes | No | READY AT BOUNDARY; real Fleeca contract/config required |
| Test login | Explicit flag + signed selection context | Yes | No | READY FOR TEST USE |
| Admin | Mixed active-character/account/service-secret model | Partial | Dedicated audit required | BLOCKED / OUT OF SCOPE |

## 10. Normal-user backend verdict

**READY IN APPLICATION CODE, WITH DEPLOYMENT DEPENDENCIES.**

The audited normal-user private backend uses canonical active-character identity, sibling-character isolation is executable, client actor IDs do not override the signed actor, profile onboarding no longer trusts external identity from the browser, and listing-credit publication fails closed without the atomic RPC.

Deployment readiness still requires:

1. Confirming the existing atomic listing/payment/boost RPC migrations are present in the target database through the controlled deployment process.
2. Supplying and validating official GTA World and Fleeca production contracts/configuration.
3. Completing the separate admin authorization redesign.

## 11. Validation

Completed before final report:

- `npx tsc --noEmit`
- package-specific hardening tests
- `npm test`
- `npm run build`
- `git diff --check`
- `git status`

## 12. Recommended next package

1. Unify admin authorization around a documented canonical admin actor/service-auth model.
2. Split admin read/mutation domains and remove ambiguous `SYSTEM_ADMIN` fallback behavior.
3. Perform controlled production preflight for required atomic RPCs and schema compatibility, without guessing or rewriting data.
4. Activate real GTA World/Fleeca adapters only from official provider contracts and add callback/reconciliation tests.