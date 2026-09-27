# SANBOARD Performance Baseline — Package 1

Date: 2026-09-27
Scope: measurement, Server-Timing, static hot-path audit. No SQL, migration apply, production DB access, cache expansion, authorization relaxation, or broad optimization was performed.

## 1. Observed browser baseline

Production observations supplied for this package:

| Endpoint / area | Total | Waiting for server |
|---|---:|---:|
| `/api/dealers/eligibility` | ~1.96 s | ~1.91 s |
| `/api/account/bootstrap` | ~1.65 s | ~1.60 s |
| listings | 1.3–2.0 s | dominant |
| favorites | ~2.05 s | dominant |
| tickets | ~1.39 s | dominant |
| payments | ~0.94 s | dominant |
| profile | ~0.85 s | dominant |
| corporate apply | ~1.67 s | dominant |

Payloads are small; the primary hypothesis is server-side remote-call latency, not bandwidth. This package adds `Server-Timing` so the next production capture can distinguish `actor`, endpoint repository/business work, and `total`. Static code analysis cannot truthfully assign the existing 1.9 s/1.6 s observations to a precise stage before instrumented production requests are captured.

## 2. Hot endpoint inventory

All authenticated endpoints below are private, dynamic, and must not use shared/public caching.

| Route | Main consumer | Actor | Purpose / repository |
|---|---|---|---|
| `/api/account/bootstrap` | `src/app/hesabim/page.tsx` | `resolveOwnedActiveProfile` | overview profile, listing/favorite/credit/store/ticket counts; direct Supabase |
| `/api/dealers/eligibility` | account layout, corporate flow, listing flow | `resolveOwnedActiveProfile` | authoritative store/application/subscription state; dealer repository |
| `/api/user/profile` | `AuthContext`, profile/contact/onboarding | `resolveOwnedActiveProfile` | private profile read/update; user repository |
| `/api/user/favorites` | favorites page | `resolveOwnedActiveProfile` | full favorite listing rows; listing repository |
| `/api/favorites?listingIds=...` | `FavoriteButton` batch hydrator | signed session only for optional state | favorite state/count for up to 100 listing IDs |
| `/api/user/listings` | listings dashboard | `resolveOwnedActiveProfile` | personal listing rows; listing repository |
| `/api/user/payments` | payments page | `resolveOwnedActiveProfile` | payment history; payment repository |
| `/api/credits` | listing/corporate purchase flows | `resolveOwnedActiveProfile` | credit history/counts; payment repository |
| `/api/tickets` | support page | `resolveOwnedActiveProfile` | ticket list/create; ticket repository |
| `/api/notifications?countOnly=1` | global navbar dropdown | `resolveOwnedActiveProfile` | unread count; notification repository |
| `/api/dealers/apply` | corporate page | `resolveOwnedActiveProfile` | latest application/create application; dealer repository |
| `/api/admin` | `src/app/yonetim/page.tsx` | `resolveActiveAdmin` | monolithic admin aggregate plus enrichment N+1 |

`/api/listings` GET is public dynamic search. Public pages `/`, `/arac`, `/mulk`, `/ilan/[id]` use 30-second revalidation; `/premium/[id]` and `/user/[id]` use 60 seconds. Route Handlers are uncached by default in the installed Next.js 16.3.6 documentation.

## 3. Page request graph

### Account overview `/hesabim`

On a normal production mount after auth state is available:

1. Global `AuthProvider`: `/api/auth/session` when no server-supplied initial profile exists.
2. Global navbar: `/api/notifications?countOnly=1`, then every 60 seconds.
3. Account layout: `/api/dealers/eligibility` on active-profile change.
4. Overview page: `/api/account/bootstrap` on active-profile change.

Overlap: bootstrap already returns profile, corporate/store state, credit count, favorite count and open-ticket count; layout still requests richer authoritative eligibility separately. Auth/session and bootstrap both return profile-shaped data. This is duplicate/related data, but no merge was implemented.

### Account subpages

The layout does **not** fetch all hidden tabs. Each mounted route fetches only its own main dataset, plus the global session, notification count, and layout eligibility requests:

- profile/contact: existing `currentProfile`; writes call `/api/user/profile`; `refreshProfile()` can trigger a subsequent GET.
- listings: `/api/user/listings`.
- favorites: `/api/user/favorites`.
- payments: `/api/user/payments`.
- support: `/api/tickets`.
- notifications page: `/api/notifications`, while navbar independently requests count-only.

Thus tickets/payments/listings are not eagerly loaded while viewing another account tab. The universal eligibility request is eager for every account subpage even when corporate controls are not immediately used.

### Corporate dashboard `/hesabim/kurumsal`

Initial production mount starts:

- layout `/api/dealers/eligibility`;
- page parallel group: `/api/dealers/profile`, `/api/dealers/listings`, `/api/dealers/apply`;
- after dealer profile resolves, `/api/dealers/{id}/followers` starts sequentially;
- global notification count and possible initial auth/session requests also run.

The three corporate page calls each resolve the same actor independently. Dealer profile and dealer listings each re-query store ownership; eligibility also queries store plus application. This is the largest same-page duplication found.

## 4. Actor resolver cost map

### `resolveOwnedActiveProfile()`

- Signed session verification: local cookie read, HMAC-SHA256 verification, expiry validation; **0 remote calls**.
- Canonical profile/ownership/role lookup: `getProfileById(session.profileId)`.
- In Supabase mode, `getProfileById` currently performs a canonical `id` lookup and then an `external_character_id` lookup even when the canonical UUID row exists: **2 sequential remote calls**.
- Ownership comes from DB-fresh `character_profiles.user_id` comparison.
- Role comes from the same DB-fresh profile row.
- No separate account-status lookup for a normal actor.
- No sibling/account aggregate query.
- No global per-user actor cache.

Therefore one normal invocation is **2 sequential Supabase calls** on the canonical UUID path. Several routes immediately read the same profile again: profile GET totals four calls, while ticket creation and profile mutations repeat profile reads too.

### `resolveActiveAdmin()`

After `resolveOwnedActiveProfile()`, it checks the DB-fresh profile role and calls `getUserById()` for DB-fresh account status: **1 additional remote call**, total **3 sequential calls**. This security model is intentionally preserved.

## 5. Endpoint query-count matrix

Counts are known/estimated from the production Supabase code path. “Parallel” is the maximum concurrent remote group after prerequisite stages, not an additional count.

| Endpoint | Actor | Business | Total remote | Sequential critical path | Parallel group | Priority |
|---|---:|---:|---:|---:|---:|---|
| `/api/dealers/eligibility` | 2 | 2 | **4** | 3 stages | dealer + canonical application in parallel | P0 / HIGH benefit |
| `/api/account/bootstrap` with listings | 2 | 7 | **9** | 4 stages (2 actor + parallel group + final count) | 6 | P0 / HIGH |
| `/api/user/favorites` non-empty | 2 | 3 | **5** | 4 stages | 2 enrichment calls | P0 / HIGH |
| `/api/user/listings` non-empty | 2 | 3 | **5** | 4 stages | 2 enrichment calls | P0 / HIGH |
| `/api/user/profile` GET | 2 | 2 repeated profile lookup | **4** | **4** | 0 | P0 / HIGH |
| `/api/tickets` GET | 2 | 1 | **3** | **3** | 0 | P1 / MEDIUM |
| `/api/user/payments` GET | 2 | 1 | **3** | **3** | 0 | P1 / MEDIUM |
| `/api/credits` GET | 2 | 1 | **3** | **3** | 0 | P1 / MEDIUM |
| `/api/notifications?countOnly=1` | 2 | 1 | **3** | **3** | 0 | P0 when duplicated/polled |
| `/api/notifications` full | 2 | 2 | **4** | 3 stages | 2 | P1 / MEDIUM |
| `/api/dealers/profile` GET | 2 | 1 | **3** | **3** | 0 | P1 / MEDIUM |
| `/api/dealers/listings` non-empty | 2 | 4 | **6** | 5 stages | 2 enrichment calls | P0 / HIGH |
| `/api/dealers/apply` GET | 2 | 2 | **4** | **4** | 0 | P1 / MEDIUM |
| `/api/favorites?listingIds=...` | 0 DB actor | 1 | **1** | **1** | 0 | P2 / LOW |

Admin aggregate: actor 3, initial aggregate functions run concurrently, then `A` application profile queries, `3D` dealer enrichment queries, then 2 payment/package queries. Exact base count depends on helper implementations, but the explicit variable component is **A + 3D** remote calls and is the largest N+1.

## 6. Sequential query candidates

Report-only candidates for Package 2:

1. `SupabaseUserRepository.getProfileById`: canonical and external lookup are sequential; for a signed canonical UUID, the external lookup is usually unnecessary. Security-sensitive; use a canonical-only resolver path rather than weakening ownership.
2. Profile GET: actor already loaded the DB-fresh profile, then route loads it again.
3. Corporate page: profile/listings/apply already run in parallel, but each repeats actor and overlapping dealer/application reads.
4. Corporate follower request waits for dealer profile. This dependency is legitimate because dealer ID is required.

## 7. N+1 findings

### Largest: `/api/admin`

- Location: `src/app/api/admin/route.ts`.
- Pending applications: one character profile query per application (`A`).
- Dealers: three queries per dealer (`3D`) for owner name, active listing count, follower count; queries are parallel per dealer and all dealers are mapped concurrently, but remote request count still scales linearly.
- Likely replacement: batched `IN` profile lookup, grouped listing/follower counts, or a purpose-built paginated admin aggregate view/RPC. Risk MEDIUM/HIGH because admin response and authorization must remain unchanged.

### Corporate listing publication notifications

- Location: `src/app/api/listings/route.ts`.
- One notification insert per valid follower via `Promise.all`.
- Loop size: follower count; query count: `F` inserts after two preliminary queries.
- Likely replacement: controlled bulk insert. This is a mutation hot path, not the measured dashboard read path.

No listing-per-row seller lookup was found in the audited dashboard list repository paths; listing enrichments are batched by listing ID.

## 8. Duplicate frontend request findings

- **P0, HIGH benefit, LOW/MEDIUM risk:** corporate dashboard repeats actor resolution across eligibility, dealer profile, dealer listings and application requests; store/application data overlaps.
- **P1, MEDIUM benefit, LOW risk:** account overview requests both eligibility and bootstrap; bootstrap corporate data is related but less authoritative/complete than eligibility.
- **P1, MEDIUM benefit, LOW risk:** notifications page full-list request coexists with navbar count-only request. They are separate mounted consumers; not necessarily simultaneous after route transitions, but duplication is possible.
- Notification count has one consumer (`NotificationDropdown`). Production performs one mount request plus 60-second polling. React Strict Mode may double-run effects in development; that must not be reported as production duplication.
- Favorite buttons use a module-level hydration queue and batch up to 100 listing IDs; this avoids per-card request N+1.

## 9. Eager-loading findings

- Hidden account tabs are not eagerly fetched.
- The account layout eagerly fetches corporate eligibility on every `/hesabim/*` page.
- Global navbar eagerly fetches notification count on every authenticated page and polls every 60 seconds.
- Corporate dashboard eagerly fetches profile, all corporate listings, latest application, then follower rows even if only one subsection is visible.
- List endpoints are generally unpaginated, so “one request” can still transfer an unbounded dataset.

## 10. Cache classification

### PRIVATE AUTHENTICATED

Account bootstrap, eligibility, private profile, favorites, user listings, payments, credits, tickets, notifications, corporate profile/apply/listings, admin. No shared public cache should be added. Current Route Handlers are dynamic/uncached by default; bootstrap explicitly uses `force-dynamic`.

### PUBLIC DYNAMIC

`/api/listings` search and public favorite-count/state API. The listings API has no explicit cache opt-in and is dynamic.

### PUBLIC SEMI-STATIC

Home, vehicle/property feeds and listing detail: 30-second revalidation. Public store and public user profile: 60-second revalidation.

### STATIC

Static assets and immutable uploaded media policy are outside authenticated API timing scope.

## 11. Vercel / Supabase region findings

- No `vercel.json` was found.
- No `preferredRegion`, function region, or route `runtime` declaration was found in application code.
- Deployment therefore relies on platform defaults unless configured outside the repository.
- Supabase project region cannot be reliably derived from repository configuration or URL without exposing/guessing environment details.
- **Supabase project region must be checked manually**, then compared with the deployed Vercel function region.

Supabase clients and repository instances are module-level singletons. Wrapper/client construction is not the primary issue; remote PostgREST request count and region RTT are the primary metrics.

## 12. Index / query candidates (report only)

Existing locked performance migration includes public category, personal/corporate listing status+published, corporate subscription/moderation, and ticket profile+updated indexes. No migration was changed or applied.

Candidates to verify against the actually applied production schema:

| Table | Candidate columns | Affected query | Reason |
|---|---|---|---|
| `payments` | `(profile_id, created_at DESC)` | payment history | filters profile, orders newest; existing status/date index is not equivalent |
| `corporate_applications` | `(applicant_profile_id, created_at DESC)` | eligibility/apply latest history | profile filter + newest order |
| `corporate_applications` | partial/unique applicant where `status='PENDING'` | create/check pending | prevents scan/race if one pending is invariant |
| `corporate_profiles` | `(owner_profile_id, created_at DESC)` | deleted-inclusive dealer history | owner lookup with latest ordering |
| `listings` | `(seller_profile_id, created_at DESC)` partial individual | user dashboard | repository orders `created_at`, current perf index uses status/published |
| `listings` | `(corporate_profile_id, created_at DESC)` partial non-null | corporate dashboard | same mismatch |
| `listing_images` | `(listing_id)` | embedded listing image relation | repeated FK/join shape; verify existing implicit/explicit index |

`listing_price_history(listing_id, changed_at DESC)` already exists in checked-in migrations. Favorites, credits, notifications and ticket lookup indexes also exist in migrations; deployment must still be verified manually.

## 13. Security constraints preserved

- Signed `sanboard_session` remains the only actor source.
- Plain user/profile/role cookies and client IDs were not introduced as authority.
- `resolveOwnedActiveProfile()` ownership and DB-fresh profile role behavior is unchanged.
- `resolveActiveAdmin()` still requires DB-fresh profile `ADMIN` and DB-fresh active user status.
- No account-scoped admin inheritance, global actor cache, public caching of private responses, or removed security check.
- Server-Timing contains only allowlisted generic stage names and numeric durations; no IDs, email, tokens, SQL, secrets or provider payloads.

## 14. Package 2 — canonical actor and bootstrap waterfall

Date: 2026-09-27

### Production timing before Package 2

| Endpoint / stage | Observed server timing |
|---|---:|
| eligibility `actor` | ~465 ms |
| eligibility total server | ~1.15 s |
| bootstrap `actor` | ~910.8 ms |
| bootstrap business | ~612.2 ms |
| bootstrap trailing `favorites` | ~673.3 ms |
| bootstrap total server | ~2.20 s |

These are pre-change production observations. No post-optimization millisecond claim is made until the package is deployed and measured again.

### Signed-session canonical guarantee

- OAuth sync returns persisted `character_profiles` rows with canonical database `id` values.
- Single-character OAuth login signs `selectedProfile.id`.
- Multi-character OAuth login and temporary test login create only a signed character-selection context; the selection/switch endpoint resolves the submitted identifier with the generic collision-safe resolver, verifies `profile.user_id === authenticatedUserId`, then signs `profile.id`.
- Therefore normal full sessions contain canonical `character_profiles.id`, while generic external-ID resolution remains available only at identity-selection boundaries.

### Architecture and round trips

| Path | Before | After Package 2 |
|---|---|---|
| `resolveOwnedActiveProfile` | canonical query + external-ID query: 2 remote calls for UUID session IDs | explicit canonical `id` query: 1 remote call |
| eligibility | actor 2 calls, then store + application parallel | actor 1 call, then the existing store + canonical application parallel wave |
| bootstrap without personal listings | actor 2 + 6-query business wave = 8 calls | actor 1 + 5-query business wave = 6 calls |
| bootstrap with personal listings | actor 2 + 6-query business wave + trailing favorites = 9 calls | actor 1 + 5-query business wave + trailing favorites = 7 calls |

The actor result now carries its DB-fresh verified profile internally. Bootstrap reuses it and no longer re-queries `character_profiles`; the API profile response shape is unchanged.

### Received-favorites decision

`stats.totalReceivedFavorites` is the exact total number of favorite rows attached to the active character's individual listings. The account overview reads it as a summary value; no per-listing values are required. The current schema/repository has no audited owner-scoped aggregation RPC/view, and the exact query currently depends on listing IDs returned by the personal-listings query. Package 2 therefore retains the separate `favorites` stage rather than approximating, loading all favorites, or introducing an unreviewed database object.

Unresolved controlled DB candidate:

| Table | Columns / query | Expected benefit |
|---|---|---|
| `favorites` joined to `listings` | exact `COUNT(favorites.id)` where `listings.seller_profile_id = profileId`, `seller_type = 'INDIVIDUAL'`, and `corporate_profile_id IS NULL`; verify/add `favorites(listing_id)` if absent | allows owner-scoped exact aggregate to start in the main bootstrap parallel wave and removes the trailing network phase |

No migration or SQL was created or applied in this package.

### Security invariants retained

- Signed `sanboard_session` remains authoritative; plain cookies and body/query profile or role values remain non-authoritative.
- Actor ownership remains `profile.user_id === session.userId`.
- Actor role remains DB-fresh `character_profiles.role`; stale signed role is not trusted.
- Generic `getProfileById()` still supports canonical IDs, external IDs, UUID-looking external IDs, and fail-safe namespace collision detection.
- Admin resolution still additionally requires DB-fresh active account status and the active profile's DB-fresh `ADMIN` role.
- No global actor cache, shared private-data cache, migration, SQL execution, or production DB access was introduced.

## 14. Package 2 priority order

1. **P0 / HIGH benefit / MEDIUM risk:** introduce a canonical-ID-only DB-fresh actor lookup or return/reuse the loaded profile, removing the unconditional second external-ID query while preserving ownership and role checks.
2. **P0 / HIGH / MEDIUM:** redesign corporate dashboard reads to avoid four independent actor/store/application graphs; prefer a narrowly scoped private corporate dashboard read model, not a universal mega-bootstrap.
3. **P0 / HIGH / MEDIUM:** batch/paginate admin domains and replace `A + 3D` enrichment N+1.
4. **P0 / HIGH / LOW-MEDIUM:** remove repeated profile reads after actor resolution and reuse canonical store/application results across the corporate page graph.
5. **P1 / MEDIUM-HIGH / MEDIUM:** paginate unbounded favorites/listings/payments/tickets and replace full-row favorite/history enrichment with grouped aggregates; verify/add matching indexes only after production plans are inspected.

## Server-Timing instrumentation

Instrumented GET paths:

- account bootstrap
- dealer eligibility
- user favorites
- user listings
- user profile
- tickets
- user payments
- notifications count/full

Example expected header:

`Server-Timing: actor;dur=180.0, store;dur=240.0, total;dur=425.0`

Chrome Network Timing will show whether eligibility’s current ~1.9 s is dominated by `actor` or `store`, and whether bootstrap’s ~1.6 s is dominated by `actor`, the six-call `bootstrap` parallel group, or the trailing `favorites` count.

## 15. Package 3 — listings, favorites, and payment history hot paths

Date: 2026-09-27

### Production baseline supplied for Package 3

| Request | Observed production total |
|---|---:|
| `/api/user/listings` | ~690 ms–1.02 s |
| `/api/user/favorites` | ~688 ms |
| `/api/favorites?listingIds=...` | ~433 ms |
| `/api/user/payments` | ~518 ms |

Bootstrap is outside Package 3 scope. No local result below is presented as a production-latency claim; deployment and a new production capture are required to measure milliseconds.

### Exact route and consumer inventory

| Route | Consumer / page | Actor resolution | Repository purpose |
|---|---|---|---|
| `GET /api/user/listings` | `src/app/hesabim/ilanlarim/page.tsx` at `/hesabim/ilanlarim` | `resolveOwnedActiveProfile()` | Active character's individual listing history, including ACTIVE and EXPIRED UI tabs |
| `GET /api/user/listings/[id]` | `src/app/hesabim/ilanlarim/[id]/duzenle/page.tsx` | `resolveOwnedActiveProfile()` plus repository ownership plus `seller_profile_id === actor.profileId` | One editable owned listing; SOLD/REMOVED remain non-editable |
| `GET /api/user/favorites` | `src/app/hesabim/favorilerim/page.tsx` | `resolveOwnedActiveProfile()` | Active character's favorite listing cards and authoritative private membership |
| `GET /api/favorites?listingIds=...` | batched `FavoriteButton` hydration on public listing cards/details | signed session supplies optional profile membership; aggregate count remains global | Up to 100 listing aggregate counts plus current-profile membership |
| `GET /api/user/payments` | `src/app/hesabim/odemeler/page.tsx` | `resolveOwnedActiveProfile()` | Active character's ordered payment-history display DTO |
| `GET /api/listings` | public listing/search consumers | no private actor for GET | Public listing dataset; not fetched by the audited account pages |

### Page request graph and overlap

- `/hesabim/ilanlarim`: account layout requests dealer eligibility; the page requests only `/api/user/listings`. It does not request public `/api/listings`, favorites, membership, or payments.
- `/hesabim/favorilerim`: account layout requests dealer eligibility; the page requests `/api/user/favorites`. Its `FavoriteButton` children previously also queued `/api/favorites?listingIds=...` even though the private favorites response already contained `is_favorited: true` and the same global `favorite_count`.
- `/hesabim/odemeler`: account layout requests dealer eligibility; the page requests only `/api/user/payments`.
- `/hesabim/ilanlarim/[id]/duzenle`: account layout requests dealer eligibility; the page requests only `/api/user/listings/[id]`. It does not fetch the full private listing collection or public listing dataset.

The only proven duplicate Package 3 request in one component tree was the favorites page's private list plus button membership hydration. No duplicate private/public listing dataset fetch was found on the audited account pages.

### User listings query graph

Base query:

- table: `listings`
- explicit selected columns: the existing `Listing` response fields used by the dashboard plus explicit `vehicle_details`, `property_details`, and `listing_images` fields
- filters: `seller_profile_id = active profile`, `seller_type = INDIVIDUAL`, `corporate_profile_id IS NULL`
- order: `created_at DESC`
- limit: none
- purpose: preserve the complete ACTIVE/EXPIRED history contract and listing card/edit navigation data

Dependent parallel enrichment wave after listing IDs are known:

1. `listing_price_history`: `listing_id, old_price, changed_at`; `listing_id IN (...)`; `changed_at DESC`; derives the latest previous price per listing.
2. `favorites`: `listing_id`; `listing_id IN (...)`; derives the global aggregate favorite count per listing.

Images and category details are PostgREST embedded relations in the base request, not per-row application queries. No seller/profile or corporate relation lookup is performed by this endpoint.

Before:

`actor 1 -> listings base 1 -> (price history 1 || favorite rows 1)` = **4 total remote calls including actor, 3 business calls, 3 sequential phases including actor**.

After:

`actor 1 -> narrower listings base 1 -> (price history 1 || favorite rows 1)` = **4 total remote calls including actor, 3 business calls, 3 sequential phases including actor**.

Package 3 did not invent a query-count reduction where none existed. It reduced row width while retaining the already-batched enrichment wave. There was no `for await`, per-listing query, or `Promise.all(listing.map(query))` N+1 in the current implementation.

Status behavior is unchanged: the repository still returns the active character's complete individual history and computes effective expiry; the UI still displays only ACTIVE and EXPIRED tabs. SOLD/REMOVED behavior was not redefined or filtered differently in this package.

### Favorites query graph and frontend dedupe

Base query:

- table: `favorites`
- selected favorite column: `listing_id`
- filter: `profile_id = active canonical profile`
- embedded listing projection: explicit existing listing/detail/image response fields
- purpose: active-profile favorite listing cards and authoritative membership

Dependent parallel enrichment wave after favorite listing IDs are known:

1. `listing_price_history`: batch `listing_id IN (...)`, ordered by `changed_at DESC`.
2. `favorites`: batch `listing_id IN (...)` for global aggregate counts.

Before server graph:

`actor 1 -> favorites/listings base 1 -> (price history 1 || favorite rows 1)` = **4 total remote calls including actor, 3 business calls, 3 sequential phases including actor**.

After server graph:

`actor 1 -> narrower favorites/listings base 1 -> (price history 1 || favorite rows 1)` = **4 total remote calls including actor, 3 business calls, 3 sequential phases including actor**.

There was no per-favorite listing/image query N+1 in the current implementation; PostgREST returns the embedded listing relations in the base request and enrichment is already batched.

Before favorites page lifecycle:

1. `/api/user/favorites` returned the authoritative profile-scoped rows and global counts.
2. Mounted `FavoriteButton`s queued `/api/favorites?listingIds=...` for the same IDs and membership/count values.

After favorites page lifecycle:

1. `/api/user/favorites` remains authoritative.
2. The page marks its initial membership/count as authoritative, seeds the existing `profileId:listingId` cache, and skips only that redundant hydration request.

Public listing cards and details still use `/api/favorites?listingIds=...` because public listing data does not authoritatively represent the current private profile. Global favorite count and profile-scoped `isFavorited` remain separate semantics. Cache isolation remains character-scoped through the existing `${profileId}:${listingId}` key; no cross-user/global membership cache was introduced.

### Payment history query graph and response boundary

Query:

- table: `payments`
- selected columns after Package 3: `id, order_id, amount, status, created_at`
- filter: `profile_id = active canonical profile`
- order: `created_at DESC`
- limit: none
- purpose: exactly the fields rendered by `/hesabim/odemeler`

Before:

`actor 1 -> payments select(*) 1` = **2 total remote calls including actor, 1 business call, 2 sequential phases**.

After:

`actor 1 -> payments narrow projection 1` = **2 total remote calls including actor, 1 business call, 2 sequential phases**.

No per-payment package lookup or other payment N+1 existed. Package metadata is currently hard-coded by the UI and was not added as a new query. The narrowed DTO intentionally excludes `profile_id`, `package_id`, `provider`, `external_payment_id`, idempotency data, corporate entitlement internals, and completion/provider metadata. Payment order and displayed amount/status/date remain unchanged.

### Server-Timing and security invariants

- Existing allowlisted `actor`, `listings`, `favorites`, `payments`, and `total` metrics remain active and still measure real stages.
- No fake zero-duration metric, identifier, email, SQL, token, secret, or provider payload was added to headers.
- Signed `sanboard_session -> canonical session user/profile -> resolveOwnedActiveProfile() -> DB-fresh owned character profile` remains unchanged.
- Query/body profile injection and writable legacy cookies remain non-authoritative.
- Listing ownership, favorite profile scope, payment profile scope, aggregate-count semantics, and sibling-character isolation were not relaxed.

### Index audit — report only

Existing coverage verified in repository migrations/audit:

- `listings(seller_profile_id, status, published_at DESC)` partial index for individual listings exists and is recorded as production-confirmed.
- `favorites(profile_id, listing_id)` unique constraint/index supports profile membership lookup.
- `favorites(listing_id)` supports aggregate count batches.
- `listing_price_history(listing_id, changed_at DESC)` supports latest-history batches.
- `vehicle_details.listing_id` and `property_details.listing_id` are primary keys.

Unresolved candidates; no migration or SQL was created:

| Table | Candidate columns | Query | Why / expected benefit |
|---|---|---|---|
| `listings` | `(seller_profile_id, created_at DESC)` partial where individual/non-corporate | private listings filter plus `created_at DESC` | Current confirmed index orders by `published_at`, while this endpoint orders by `created_at`; a matching index may avoid a scoped sort as history grows. Verify with production plan first. |
| `listing_images` | `(listing_id)` | embedded listing image relation | No explicit audited index was found on the foreign key; may reduce relation lookup cost for listing/favorite collections. Verify PostgreSQL catalog/plan before adding. |
| `payments` | `(profile_id, created_at DESC)` | active-profile payment history ordered newest-first | Existing audited payment index is `(status, created_at DESC)`, which does not match the profile-scoped history path. |

### Pagination decision

`/api/user/listings`, `/api/user/favorites`, and `/api/user/payments` remain unbounded. Their current pages have no pagination or load-more contract, so adding pagination here would change visible history and UI behavior. Cursor pagination remains a Package 4 candidate, together with explicit UX and response-contract work.

### Package 3 regression coverage

- Existing tests continue to cover active-character listing/favorite/payment isolation, sibling denial, actor injection rejection, idempotent favorite ADD, active-profile removal, aggregate-count separation, and private listing ownership.
- Favorites tests now assert that the favorites page explicitly reuses authoritative private membership while the shared batch hydrator and profile-keyed cache remain present.
- Payment tests now assert the exact five-field history DTO and verify that provider transaction and entitlement-internal fields do not leak.
- No migration, SQL execution, RPC/view creation, Supabase Dashboard change, production DB connection, commit, or push was performed.