# SANBOARD — Generic Character Feature Isolation — Package 1

Date: 2026-09-26

## 1. Scope

This package implements only:

1. Credit history authorization.
2. Payment history authorization.
3. Removal of unsigned actor fallback in those endpoints and the closely related notifications route.
4. A narrow, provider-neutral `/api/user/characters` DTO.

No SQL, migration, production database operation, commit, or push was performed. Boost integrity, subscription expiry, admin authorization redesign, real GTA World/Fleeca endpoints, removed-character lifecycle, and character-count limits remain out of scope.

## 2. Canonical actor rule

Private character-scoped operations must derive the actor as follows:

`signed sanboard_session -> canonical session.userId/session.profileId -> resolveOwnedActiveProfile() -> DB-fresh character_profiles row`

`resolveOwnedActiveProfile()` verifies that the signed profile exists, belongs to the signed account, and returns the DB-fresh profile role. Query parameters, request bodies, external character IDs, routing cookies, and client roles are not actor identity.

## 3. Credit history before/after

### Before

`GET /api/credits` accepted `query.profileId`; when absent it accepted the client-writable `sanboard_profile_id` cookie. The repository then correctly filtered `listing_credits.profile_id`, but the caller controlled that profile ID. Sibling-character and cross-account reads were therefore possible.

### After

The route requires `resolveOwnedActiveProfile(req)` and queries only `getUserCredits(actor.profileId)`. Legacy `profileId` query values and routing cookies are ignored. The response contains only the signed active character's full credit history and calculated available/individual/corporate counts. Logged-out requests return `401`.

## 4. Payment history before/after

### Before

`GET /api/user/payments` required caller-provided `query.profileId`. The repositories correctly filtered `payments.profile_id`, but the caller selected the owner and could read sibling or foreign-character history.

### After

The route requires `resolveOwnedActiveProfile(req)` and queries only `getUserPayments(actor.profileId)`. Query/cookie actor injection is ignored. Payment rows remain canonically owned by `payments.profile_id -> character_profiles.id`. Entitlement and payment completion logic was not changed.

## 5. Actor fallback inventory

| Endpoint/area | Classification | Current actor/auth source | Package 1 result |
|---|---|---|---|
| `/api/listings` GET, compare, similar, public dealer/profile browse | PUBLIC | No actor required, optional viewer state in some paths | Retained; public routes were not made private |
| `/api/credits` GET | PRIVATE READ | `resolveOwnedActiveProfile()` | Fixed |
| `/api/user/payments` GET | PRIVATE READ | `resolveOwnedActiveProfile()` | Fixed |
| `/api/notifications` GET/POST | PRIVATE READ/MUTATION | `resolveOwnedActiveProfile()` | Closely related shared fallback fixed |
| `/api/favorites` mutation | PRIVATE MUTATION | `resolveOwnedActiveProfile()` | Already authoritative |
| `/api/dealers/[id]/follow` mutation | PRIVATE MUTATION | `resolveOwnedActiveProfile()` | Already authoritative |
| `/api/checkout` | PRIVATE READ/MUTATION | Signed session profile; order ownership check | Existing behavior retained; DB-fresh actor standardization remains follow-up |
| `/api/listings` POST/PUT | PRIVATE MUTATION | Signed session with body/cookie fallbacks | PARTIAL / remaining blocker |
| `/api/user/listings/[id]` GET/PUT | PRIVATE READ/MUTATION | Query/cookie/body fallbacks in some methods | PARTIAL / remaining blocker |
| `/api/tickets`, `/api/tickets/[id]` | PRIVATE READ/MUTATION | Query/body/cookie-supplied identity/role | PARTIAL / remaining blocker |
| `/api/dealers/apply` | PRIVATE READ/MUTATION | Signed session with body fallback; GET query actor | PARTIAL / remaining blocker |
| `/api/dealers/eligibility` | PRIVATE READ | Session/query/routing-cookie fallback | PARTIAL / remaining blocker |
| `/api/user/profile` | Mixed public/private profile operations | Query and routing-cookie fallbacks remain in some paths | PARTIAL; requires endpoint-contract separation |
| `/api/admin`, `/api/admin/audit` | ADMIN | Admin-specific logic | Reported only; admin is out of scope |
| GTA World OAuth callback/login | EXTERNAL CALLBACK | OAuth state/provider authentication | Retained; normal character actor rule does not apply |
| `/api/auth/session`, `/api/user/characters` before character selection | AUTH/SELECTION | Signed full session or signed short-lived selection context | Retained; selection context is cryptographically signed |

## 6. Removed/retained cookie usages

### Removed as authorization input

- `/api/credits`: removed `sanboard_profile_id` actor fallback.
- `/api/notifications` GET/POST: removed `sanboard_profile_id` actor fallback.
- Credit/payment frontend consumers no longer submit `profileId` as actor.

### Retained

- `sanboard_session`: signed HttpOnly authorization session.
- `sanboard_character_selection`: signed, short-lived pre-session character-selection context.
- `sanboard_profile_id`, `sanboard_user_id`, `sanboard_role`: still written as legacy routing/UI hints because removing them globally would exceed this package. They are not authoritative in credit, payment, notification, favorite, or follow authorization.
- Some listing, ticket, corporate application/eligibility, profile, and server-rendered public-detail paths still read writable routing cookies or client IDs. These are documented blockers for the next actor-hardening package.
- OAuth attempt cookie remains because it protects external callback state rather than representing a character actor.

## 7. Character DTO before/after

### Before

`/api/user/characters` returned:

- GTA World-named `GtaWorldCharacter` values.
- `externalCharacterId`.
- `hasProfile`, `avatarPath`, SanMail, and phone fields.
- A separate `profiles` array containing raw `character_profiles` persistence rows, including `user_id`, provider identity, timestamps, flags, and contact data.

### After

The endpoint returns:

```ts
interface CharacterSummary {
  id: string;              // canonical character_profiles.id
  displayName: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';  // currently required by safe UI/session conventions
}
```

Response envelope:

```ts
{
  success: true;
  characters: CharacterSummary[];
  isTestIdentity: boolean;
}
```

It no longer returns raw profiles, `users.id`, `user_id`, `external_character_id`, GTA World raw IDs/field names, contact data, timestamps, or internal flags. Mock/test and real synchronized characters use the same DTO.

## 8. Generic character isolation tests

Executable tests use:

- Account: `external-account-isolation-01`.
- Characters: Alex Stone, Jordan Reed, Morgan Hale.
- A separate cross-account character.

Covered scenarios:

- Alex receives only `credit-A1` and `credit-A2`.
- Jordan receives only `credit-B1`.
- Signed Alex plus `?profileId=Jordan` and a Jordan routing cookie still resolves Alex.
- Cross-account session plus an Alex query returns no Alex credits.
- Logged-out credit history returns `401`.
- Alex receives only `payment-A`; Jordan receives only `payment-B`.
- Payment query/cookie injection cannot switch the actor.
- Cross-account payment injection returns no foreign history.
- Logged-out payment history returns `401`.
- Character picker returns only the three signed-account summaries and exposes no raw profile/provider fields.

## 9. Remaining application blockers

1. Listing create/update and private listing edit/read paths still contain body/query/cookie actor fallbacks.
2. Tickets accept profile identity and sender role/name from client-controlled inputs.
3. Corporate application and eligibility paths still accept caller-selected profile IDs.
4. Some user profile operations mix public lookup and private mutation semantics and still use routing-cookie/body fallback.
5. Checkout uses signed session ownership, but not every method uses the standardized DB-fresh resolver.
6. Admin fallback/bypass behavior requires its own package and was not changed.
7. Public detail server rendering still uses routing cookies for optional viewer overlays; authorization-sensitive behavior must be separated from public rendering.

## 10. Out-of-scope items

- Boost consumption atomicity/integrity.
- Subscription expiry/renewal.
- Admin role hierarchy or bypasses.
- Real GTA World endpoint activation.
- Real Fleeca verification/callback boundary.
- Removed-character lifecycle.
- Three-character limit.
- Payment entitlement RPC/business logic.
- UI polish.

## 11. Next package

Recommended four items:

1. Listing create/edit/private-read actor standardization with `resolveOwnedActiveProfile()`.
2. Ticket read/create/reply ownership and server-derived sender identity.
3. Corporate application and eligibility actor isolation.
4. User profile endpoint separation into public DTO lookup and signed active-character private mutation.

## Readiness matrix

| Feature | Actor source | Character isolated? | Client actor injection possible? | Ready for unknown GTAW character? |
|---|---|---:|---:|---:|
| Favorite | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Follow | `resolveOwnedActiveProfile()` | YES | NO for mutation | YES |
| Credit history | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Payment history | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Listing create | Session or client `sellerProfileId` fallback | PARTIAL | YES when unsigned | PARTIAL |
| Listing edit | Session plus body/query/cookie fallbacks in multiple routes | PARTIAL | YES | PARTIAL |
| Notifications | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Tickets | Client query/body profile and sender fields | NO | YES | PARTIAL |
| Corporate application | Session or body/query profile fallback | PARTIAL | YES | PARTIAL |
| Character picker | Signed session or signed selection context; `CharacterSummary` output | YES at account-list level | NO unsigned raw ID context | YES |
