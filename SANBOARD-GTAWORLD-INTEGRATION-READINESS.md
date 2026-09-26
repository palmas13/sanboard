# SANBOARD — GTA World Integration Readiness

Date: September 26, 2026

## 1. Current architecture

The intended production flow is:

`RAW GTA WORLD DATA → GTA World adapter → ExternalGameAccount / ExternalGameCharacter → syncExternalGameAccount() → canonical users / character_profiles → signed selection context or signed full session`

The raw GTA World transport and payload contract is deliberately absent until official documentation arrives. `RealGtaWorldAuthProvider` is a fail-closed boundary and returns `GTAWORLD_PROVIDER_NOT_CONFIGURED`; it does not contain guessed URLs, scopes, token formats, callback parameters, or payload fields.

## 2. Provider boundary

Application-facing provider contract:

```ts
interface GtaWorldAuthProvider {
  getAuthorizeUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<string>;
  fetchAccount(accessToken: string): Promise<ExternalGameAccount>;
}

interface ExternalGameAccount {
  externalAccountId: string;
  characters: ExternalGameCharacter[];
}

interface ExternalGameCharacter {
  externalCharacterId: string;
  displayName: string;
  avatarUrl?: string | null;
}
```

External IDs are opaque strings. Numeric, prefixed, UUID-looking, and mixed-format values are supported without UUID parsing. Provider data cannot assign an admin role; newly synchronized users and characters default to `USER`.

Legacy raw placeholder types and `adaptGtaWorldApiUser()` remain only for older regression tests. They are marked deprecated and are not reachable from the production provider.

## 3. Canonical sync behavior

- Unknown account: creates one canonical `users` row with an internal UUID.
- Unknown characters: create canonical `character_profiles` rows with internal UUIDs and correct ownership.
- Repeat login: reuses account and profile rows.
- Concurrent first login: Supabase unique-conflict recovery converges on the existing account/profile. Memory tests also converge under the current synchronous mutation model.
- Rename: matches only by `external_character_id`, retains canonical profile ID and Sanboard-owned business relations, updates `full_name`.
- Cross-account character collision: throws an identity-collision error before ownership mutation; no transfer or duplicate identity is created.
- Missing character in a later response: is not deleted, disabled, or detached. Lifecycle policy remains unresolved pending the official contract.
- Zero-character account: canonical account creation is allowed by the current architecture, no profile is fabricated, no full character session is created, and the picker shows an explicit safe empty state.

## 4. Login and session flow

### Real GTA World login

- `/api/auth/gtaworld/login` calls only `RealGtaWorldAuthProvider`.
- Because the official contract is absent, it redirects to `/giris?error=provider_not_configured`.
- No mock provider, fake callback, fake token, user row, or character profile is created.
- Login attempt support is ready as a generic signed HMAC token with random state/nonce, ten-minute expiry, HttpOnly cookie, `Secure` in production, and `SameSite=Lax`.
- Callback requires a valid signed attempt and an exact returned state match. Missing, stale, malformed, or tampered attempts fail closed.
- Attempt cookies are cleared on callback success and failure responses. This prevents replay through the same browser cookie after consumption; distributed/server-side replay tracking is not added because no provider contract exists yet.

### Redirect safety

Auth `redirect` inputs are normalized to relative internal paths. Absolute URLs, protocol-relative paths, backslashes, control characters, `javascript:` values, and repeatedly encoded external redirects fall back to `/`.

### Single character

Exactly one synchronized canonical profile is selected directly. The signed full session stores canonical `users.id`, canonical `character_profiles.id`, and the profile role read from the database result.

### Multiple characters

No full session is created before selection. A signed ten-minute character-selection context containing only the canonical user ID is set. The picker receives `CharacterSummary`; `POST /api/auth/session` verifies ownership, reads the current profile role, clears selection context, and creates the full signed session. Pre-selection `GET /api/auth/session` remains `401`.

## 5. Frontend DTO boundary

The picker consumes only:

```ts
interface CharacterSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}
```

It does not receive external account IDs, external character IDs, provider tokens, raw GTA World payloads, or assumed GTA World name fields. Missing avatar uses initials; production sync does not inject demo/Unsplash avatars.

## 6. Test provider boundary

`ENABLE_TEST_LOGIN=true` exposes only the explicit `/test-giris → /api/auth/test-login` harness. Its identities use reserved `test-login:*` namespaces and still pass through `ExternalGameAccount → syncExternalGameAccount() → signed selection context → canonical session`.

The normal GTA World login route never imports or selects `MockGtaWorldAuthProvider`. Disabling the flag hides/denies the test route and prevents existing test selection contexts from creating sessions.

## 7. Unknown contract blockers

All 24 items in `SANBOARD-GTAWORLD-INTEGRATION-CONTRACT-REQUIRED.md` remain unknown. The most architecture-sensitive blockers are:

- authorization/token/account/character transport contracts;
- callback and state guarantees;
- ID stability and global uniqueness;
- character removal, hiding, deletion, and transfer semantics;
- avatar guarantees;
- token lifetime, refresh, revocation, errors, and rate limits;
- zero-character and suspended/banned account semantics.

## 8. Exact files to implement when official docs arrive

Primary implementation files:

1. `src/lib/integrations/gtaworld/real-provider.ts` — implement confirmed OAuth/API transport only.
2. `src/lib/integrations/gtaworld/types.ts` — replace deprecated placeholder raw types/adapter with exact official raw response types and mapping.
3. `src/app/api/auth/gtaworld/login/route.ts` — adjust orchestration only if the confirmed authorization contract requires parameters beyond the abstract provider call.
4. `src/app/api/auth/gtaworld/callback/route.ts` — adjust extraction only for confirmed callback delivery/parameter semantics.
5. `.env.example` — add only officially required server-side configuration names.
6. `tests/gtaworld-oauth-and-isolation.test.ts` — replace fail-closed assertions with exact provider contract tests.
7. `tests/gtaworld-provider-boundary-readiness.test.ts` — retain canonical boundary/security regressions and add official raw adapter fixtures.
8. `SANBOARD-GTAWORLD-INTEGRATION-CONTRACT-REQUIRED.md` and this document — record confirmed answers and remaining blockers.

## 9. What should not need changing

If the official adapter returns the existing canonical DTO correctly, these should remain unchanged:

- `syncExternalGameAccount()` and canonical UUID ownership model;
- `users` and `character_profiles` schema;
- signed Sanboard session and character-selection payloads;
- `/api/auth/session` ownership/role checks;
- `/api/user/characters` and `CharacterSummary`;
- character picker and initials fallback;
- favorites, listings, payments, boosts, corporate logic, notifications, and other character-scoped business features;
- temporary test-login route and reserved namespace boundary.

## 10. Migration status

No migration is required for this readiness package. Existing `users.external_user_id`, `character_profiles.external_character_id`, and unique provider identity constraints are sufficient for the current fail-closed boundary and canonical sync model. No production database or applied migration was touched.