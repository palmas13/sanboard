# SANBOARD — Generic Character Feature Isolation — Package 2

Date: 2026-09-26

## 1. Scope

This package hardens only listing create/edit/private reads, user ticket ownership and replies, corporate application/eligibility, and public/private user profile contracts. Boost integrity, subscription expiry redesign, real Fleeca/GTA World integrations, admin redesign, and UI polish remain out of scope.

Canonical private actor rule:

`signed sanboard_session -> canonical userId/profileId -> resolveOwnedActiveProfile() -> DB-fresh character_profiles row`

No SQL, migration, or production database operation was performed.

## 2. Listing actor before/after

### Before

- Listing create accepted `session.profileId || body.sellerProfileId`.
- `/api/listings` PUT accepted body user/profile IDs and writable routing cookies.
- `/api/user/listings/[id]` GET accepted query/cookie profile identity.
- Its PUT accepted body `profileId`, `sellerProfileId`, `characterId`, and `userId` fallbacks.

### After

- Listing create, general PUT, own-listing list/status operations, and own-listing GET/PUT/DELETE use `resolveOwnedActiveProfile()`.
- Actor-like body properties are ignored and removed before validation/repository calls.
- Created `seller_profile_id` is the signed active profile.
- Private listing ownership is verified against `listing.seller_profile_id === actor.profileId`.
- Public `/api/listings` GET and public listing detail behavior were not made private.
- Existing corporate eligibility and corporate profile assignment business rules remain intact; only their actor input is canonicalized.

## 3. Ticket actor/ownership before/after

### Before

- Ticket list trusted `query.profileId`.
- Ticket create trusted body `profileId` and `creatorName`.
- Ticket detail had no character ownership check.
- User replies trusted body/cookie `senderRole` and body `senderName`, allowing an `ADMIN` sender spoof.
- User ticket status mutation had no ownership check.

### After

- Ticket list/create/detail/reply/close require the signed active profile.
- Ticket create persists `support_tickets.profile_id = actor.profileId` and creator name from the DB-fresh character profile.
- Detail, reply, and close require `ticket.profile_id === actor.profileId`.
- Normal user replies always persist `sender_role = USER`; sender name comes from the DB profile.
- The current schema has no `ticket_messages.sender_profile_id`; adding one would require a migration, so no migration was created. Ownership remains anchored by `support_tickets.profile_id` and server-derived reply identity.
- Existing admin reply behavior stays in the separately authorized `/api/admin` path and was not redesigned.

## 4. Corporate application/eligibility before/after

### Before

- Application create used signed session with body profile fallbacks.
- Application GET trusted `query.profileId`.
- Eligibility trusted session, query, or writable routing-cookie profile IDs.

### After

- Application create and lookup use `actor.profileId` only.
- Eligibility requires `resolveOwnedActiveProfile()` and evaluates existing store, application, moderation, and subscription state for that active character.
- Existing business rules and eligibility reasons are unchanged.
- Sibling and cross-account profile injection cannot select another character's application/store state.

## 5. Public/private profile contract

### Private active profile

- `GET /api/user/profile` requires the signed active profile and ignores query/cookie actor hints.
- `PUT /api/user/profile` updates only `actor.profileId`.
- Editable fields are allowlisted: avatar URL/path, SanMail, phone, and full name.
- The private DTO contains the fields required by authenticated account UI but excludes `user_id`, `external_character_id`, provider identity, and internal timestamps.

### Public profile lookup

- `GET /api/profiles/[id]` is session-free and accepts the existing public/canonical identifier conventions.
- Public DTO: `{ id, displayName, avatarUrl, isDealer, dealerId }`.
- It does not return account IDs, external/provider character IDs, private contact data, roles, timestamps, payment state, or internal flags.
- Existing server-rendered public profile pages continue using repository-backed public lookups; no public listing/profile page was made private.

## 6. Removed actor fallbacks

Removed as authorization input in this package:

- Listing: body `sellerProfileId`, `profileId`, `characterId`, `userId`; `sanboard_user_id`; `sanboard_role`; query/cookie profile actor.
- Tickets: query/body profile IDs, body creator/sender name, body sender role, `sanboard_role`.
- Corporate: query/body profile/applicant IDs and `sanboard_profile_id`.
- Private profile: query/body profile IDs and `sanboard_profile_id`.

## 7. Retained non-authoritative cookies

`sanboard_profile_id`, `sanboard_user_id`, and `sanboard_role` are still written by login/profile-selection flows as legacy routing/UI hints. Removing them globally is outside this package. They are not read to authorize the four Package 2 feature areas.

The signed HttpOnly `sanboard_session` remains authoritative. The signed pre-session character-selection context also remains part of the login/picker flow.

## 8. Isolation/attack tests

`tests/generic-character-isolation-package-2.test.ts` uses generic Alex Stone, Jordan Reed, and Morgan Hale identities and verifies:

- listing create ignores injected `sellerProfileId` and persists the signed actor;
- own listing read succeeds while sibling listing read/edit fails;
- logged-out listing mutation returns 401;
- ticket list/detail/reply are character-isolated;
- fake `senderRole=ADMIN` and fake sender name cannot change reply identity;
- corporate application lookup/create and eligibility ignore injected character IDs;
- private profile GET/PUT ignore target profile injection;
- public profile returns only the safe DTO;
- writable routing cookie injection does not change the actor.

No feature-specific Mavis/Ravi/Zade condition or test-login bypass was added.

## 9. Remaining blockers

- Admin ticket access/reply remains a separate admin-policy surface and needs its own future audit; this package deliberately does not redesign it.
- `ticket_messages` has no sender-profile foreign key. Current user identity is server-derived, but durable sender-profile attribution would require a future schema change.
- Other private endpoints outside the named Package 2 scope may still need canonical actor review.
- Boost atomicity, subscription expiry, payment completion/RPC behavior, entitlement logic, and real external integrations remain intentionally untouched.

## 10. Next package

Recommended next package: dedicated admin authorization and moderation isolation, including admin ticket detail/reply/status policy, without name-based or fixture-based authorization. After that, address boost/subscription/payment integrity as separate business-logic packages.

## Final readiness matrix

| Feature | Actor source | Character isolated? | Client actor injection? | Ready for unknown GTAW character? |
|---|---|---:|---:|---:|
| Favorite | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Follow | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Credits | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Payments | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Notifications | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Listing create | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Listing edit | `resolveOwnedActiveProfile()` + seller ownership | YES | NO | YES |
| Own listing read | `resolveOwnedActiveProfile()` + seller ownership | YES | NO | YES |
| Tickets | `resolveOwnedActiveProfile()` + ticket ownership; server-derived sender | YES | NO | YES |
| Corporate application | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Corporate eligibility | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Private profile | `resolveOwnedActiveProfile()` | YES | NO | YES |
| Public profile | Public identifier + safe public DTO | N/A public | Identifier is target only | YES |
| Character picker | Signed account selection context + ownership verification | YES | NO | YES |