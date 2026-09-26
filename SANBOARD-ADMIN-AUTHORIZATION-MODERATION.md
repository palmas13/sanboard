# SANBOARD Admin Authorization + Moderation — Package 1

Date: 2026-09-27

## 1. Scope

This package changes human admin authorization to a canonical character-scoped model and hardens the existing ticket, report, listing, corporate-store, application and account-status moderation actions.

It does not redesign the admin UI, add provider/payment authority, add moderation states, run SQL, apply migrations, touch production data, or change the temporary `/test-giris` character fixtures.

## 2. Canonical admin identity

The authoritative chain is:

`signed sanboard_session -> canonical session.userId/session.profileId -> resolveOwnedActiveProfile() -> DB-fresh character_profiles row -> profile.role === ADMIN -> DB-fresh users.status === ACTIVE`

`resolveActiveAdmin()` implements this rule. Session role is not sufficient. Account role is not the admin role source. Client body/query values and writable cookies are never accepted as the admin actor.

## 3. Character-scoped role model

Admin authority belongs to `character_profiles.id` and its DB-fresh `role`.

- An ADMIN character can access admin reads and mutations.
- A USER sibling under the same `users.id` is denied.
- A cross-account USER is denied.
- `session.role=ADMIN` with DB `profile.role=USER` is denied.
- `sanboard_role=ADMIN`, body/query `role=ADMIN`, and injected ADMIN profile IDs are denied.
- A banned account cannot retain access through a stale signed ADMIN session.
- Newly synchronized GTA World accounts and characters still default to `USER`; provider fields, names and external IDs do not assign ADMIN.

## 4. Admin route inventory

| Route | Method | Target/read | Previous authorization | Final authorization | Audit |
|---|---|---|---|---|---|
| `/api/admin` | GET | Dashboard aggregate: listings, accounts, reports, stores/applications, tickets, payments/settings | DB-fresh profile role OR `x-sanboard-secret` | `resolveActiveAdmin()` only | Read not separately logged |
| `/api/admin` | POST `delist` | Listing removal | Shared route check; internal `SYSTEM_ADMIN` removal sentinel | `resolveActiveAdmin()`; target listing ID only from client | `ADMIN_LISTING_DELISTED` |
| `/api/admin` | POST `toggleBan` | Account ACTIVE/BANNED toggle | Shared route check | `resolveActiveAdmin()`; target account ID only | `ADMIN_ACCOUNT_STATUS_CHANGED` |
| `/api/admin` | POST `updatePrice` | Existing standard package price | Shared route check | `resolveActiveAdmin()` | `ADMIN_PACKAGE_PRICE_CHANGED` |
| `/api/admin` | POST `updateReport` | Report RESOLVED/DISMISSED | Shared route check; status not allowlisted at boundary | `resolveActiveAdmin()` + existing status allowlist | `ADMIN_REPORT_STATUS_CHANGED` |
| `/api/admin` | POST approve/reject application | Corporate application review | Shared route check | `resolveActiveAdmin()`; canonical reviewer profile ID | `ADMIN_APPLICATION_REVIEWED` |
| `/api/admin` | POST suspend/reactivate/delete store | Corporate moderation | Shared route check | `resolveActiveAdmin()`; canonical moderator profile ID | Existing corporate store audit events |
| `/api/admin` | POST `updateTicket` | Ticket OPEN/ANSWERED/CLOSED | Shared route check; arbitrary status input | `resolveActiveAdmin()` + `TicketStatus` allowlist | `ADMIN_TICKET_STATUS_CHANGED` |
| `/api/admin` | POST `adminReplyTicket` | Admin ticket reply | Fixed display name; shared route check | Canonical DB-fresh admin profile name/role | `ADMIN_TICKET_REPLIED` |
| `/api/admin/audit` | GET | Persisted audit records | Account-scoped `users.role/status` | `resolveActiveAdmin()` | Audit read not separately logged |
| `/api/tickets`, `/api/tickets/[id]` | GET/POST/PATCH | Normal user ticket ownership paths | Active character owner | Unchanged; no implicit admin bypass | Existing user behavior |
| `/api/reports` | POST | Normal user report creation | Active reporter character | Unchanged | Reporter is separate from moderator |

The repository contains no separate browser moderation routes outside `/api/admin`; normal listing edit/delete routes remain owner-only and do not gain a global ADMIN bypass.

## 5. Removed role/cookie/secret bypasses

Removed:

- Browser-accessible `x-sanboard-secret === SUPABASE_SECRET_KEY` authorization from `/api/admin`.
- Account-scoped `users.role === ADMIN` authorization from `/api/admin/audit`.
- `SYSTEM_ADMIN` fallback as a request actor when active-profile resolution fails.
- Fixed admin ticket sender identity (`Sanboard Yönetimi`).

Retained:

- `SYSTEM_ADMIN` exists only as an internal repository sentinel used by the existing listing-removal implementation for explicit moderation and store soft-delete cascades. It is not accepted from a request and is not an authorization alternative. Canonical human actor attribution is persisted separately in audit records and store moderation fields.
- Legacy role/profile cookies may still be routing hints elsewhere, but they are not read by the admin authorization resolver.

Repository search found no consumer sending `x-sanboard-secret`; its only remaining occurrence is the regression test proving it cannot authorize access.

## 6. Ticket admin policy

- Normal ticket list/detail/reply/status behavior remains character-owner scoped.
- Admin ticket list is part of the protected admin dashboard read.
- Admin reply and status mutation occur only through `/api/admin` after `resolveActiveAdmin()`.
- Reply `senderRole` is always server-set to `ADMIN`.
- Reply `senderName` is loaded from the canonical active admin profile.
- Client `senderName`, `senderRole`, role cookie and actor IDs are ignored.
- Allowed admin ticket statuses are the existing domain values: `OPEN`, `ANSWERED`, `CLOSED`.

Schema limitation: `ticket_messages` has no `sender_profile_id`. Durable canonical actor attribution is therefore stored in the admin audit event, while the message row retains the existing role/name fields. Adding a sender-profile foreign key would require a future migration and was not done.

## 7. Report moderation

Normal users can continue creating reports as the signed active reporter character. Report moderation is separate and requires a canonical ADMIN character. Only existing `RESOLVED` and `DISMISSED` status values are accepted. Moderator identity is written to the audit record and is never confused with `reporter_profile_id`.

## 8. Listing moderation

The existing explicit admin `delist` action requires `resolveActiveAdmin()`. Client input supplies only the target listing ID. Normal owner listing routes remain owner-only and did not receive an `if admin then edit anything` bypass.

The lower repository still uses its pre-existing internal `SYSTEM_ADMIN` sentinel to invoke the common removal lifecycle. The browser cannot supply or activate this sentinel. `ADMIN_LISTING_DELISTED` records the actual canonical admin profile and target listing.

Restore is not an existing admin action and was not invented.

## 9. Corporate moderation

Existing actions are retained:

- application approve/reject;
- store suspend;
- store reactivate;
- store soft delete.

All require the canonical ADMIN character. Suspension/reactivation only change moderation state and do not pause or extend subscription/listing clocks. Delete retains existing soft-delete semantics and removes active store listings through the existing lifecycle.

Application approval creates/updates an APPROVED, moderation-ACTIVE store but does not grant paid entitlement:

- `subscription_status = INACTIVE`;
- no `subscription_expires_at` is created;
- `boost_credits = 0`;
- no payment success or entitlement timestamp is written.

This behavior is aligned in both memory and Supabase repositories.

## 10. Ban/status policy

An existing account-level status toggle is present: `users.status` switches between `ACTIVE` and `BANNED`. The mutation requires a canonical ADMIN character, treats the client account ID only as the target, and records the canonical admin actor.

`resolveActiveAdmin()` also checks DB-fresh account status, so a banned admin account cannot continue through a stale signed session. No new ban hierarchy, duration or profile-level ban model was introduced.

## 11. Audit logging

The existing audit repository/table boundary is used; no migration or fake production audit system was added.

Important mutations now record:

- canonical admin `user_id` and `profile_id`;
- action event type;
- target type and target ID;
- safe action metadata;
- repository-generated timestamp.

Store suspend/reactivate/delete already had audit events and retain them. Audit metadata sanitation continues to omit secrets, tokens, codes and credential-like keys.

Known limitation: audit writes are best-effort and non-blocking by existing design. An audit storage failure does not roll back the moderation transaction.

## 12. CSRF and error notes

- Signed session cookies are HttpOnly and `SameSite=Lax`.
- Admin POST now rejects an explicitly cross-origin `Origin` header.
- Requests without `Origin` remain accepted for same-site/server/test compatibility. A full CSRF token/double-submit architecture does not exist and remains a defense-in-depth follow-up.
- Admin top-level failures return safe generic messages.
- Repository mutation failures are converted to action-specific safe messages at the browser boundary; raw Postgres/provider/secret details are not returned.

## 13. Regression tests

`tests/admin-authorization-moderation-package-1.test.ts` creates test-local synthetic characters only in memory:

- Account X: Character A = ADMIN, Character B = USER.
- Account Y: Character C = USER.

It does not modify `/test-giris` fixtures or production data.

Covered:

1. ADMIN character succeeds.
2. Same-account USER sibling is denied.
3. Cookie/body/query/profile injection is denied.
4. Cross-account USER and logged-out requests are denied.
5. Stale signed ADMIN role with DB USER role is denied.
6. Banned account stale session is denied.
7. Former secret header bypass is denied.
8. Ticket reply/status use server-derived admin identity and audit attribution.
9. USER ticket/listing/report/store moderation is denied.
10. ADMIN listing/report/store moderation succeeds with expected field changes.
11. Application approval grants no subscription, expiry or boost entitlement.
12. Explicit cross-origin admin mutation is denied.

The full pre-existing suite revalidates character switch, favorites, listing create/edit, tickets, corporate dashboard, payments and boosts.

## 14. Remaining blockers

1. `ticket_messages.sender_profile_id` does not exist; canonical reply actor is available in audit but not as a message-row foreign key. Migration required for stronger durable attribution.
2. Audit recording is best-effort rather than transactionally coupled to every mutation.
3. Full CSRF-token protection is not implemented; current posture is HttpOnly SameSite=Lax plus explicit cross-origin Origin rejection.
4. The admin API remains a broad monolithic aggregate/action endpoint with no pagination and notable N+1 behavior. This is performance/maintainability debt, not an authorization bypass.
5. Internal repository `SYSTEM_ADMIN` sentinel remains for shared removal lifecycle. It is not request-accessible, but a future repository interface could replace it with an explicit trusted moderation method.
6. No public/admin role-assignment feature exists. ADMIN role provisioning remains an operational DB responsibility until a separately designed secure provisioning system exists.

## 15. Admin readiness matrix

| Feature | Admin actor source | Sibling USER blocked? | Cookie/body spoof blocked? | Audit? | Ready? |
|---|---|---:|---:|---|---|
| Admin dashboard | `resolveActiveAdmin()` | Yes | Yes | Read not logged | YES |
| Ticket list | `resolveActiveAdmin()` | Yes | Yes | Read not logged | YES |
| Ticket detail | Admin aggregate; normal route remains owner-only | Yes | Yes | Read not logged | YES, current UI contract |
| Ticket reply | DB-fresh admin profile | Yes | Yes | Yes | YES, with sender FK limitation |
| Ticket status | `resolveActiveAdmin()` + enum allowlist | Yes | Yes | Yes | YES |
| Reports | `resolveActiveAdmin()` + report status allowlist | Yes | Yes | Yes | YES |
| Listing moderation | `resolveActiveAdmin()` explicit delist action | Yes | Yes | Yes | YES |
| Corporate application review | `resolveActiveAdmin()` | Yes | Yes | Yes | YES |
| Corporate store moderation | `resolveActiveAdmin()` | Yes | Yes | Yes | YES |
| Account ban/status | `resolveActiveAdmin()` | Yes | Yes | Yes | YES |
| Audit log read | `resolveActiveAdmin()` | Yes | Yes | N/A | YES |

## Final admin verdict

**YES, with documented durability/defense-in-depth limitations.**

A previously unknown canonical GTA World character whose DB `character_profiles.role` is `ADMIN` can perform the existing Sanboard moderation actions without granting ADMIN authority to sibling characters. Authorization is DB-fresh and character-scoped. Remaining blockers concern durable ticket sender foreign-key attribution, transactional audit guarantees, full CSRF-token defense, monolithic endpoint performance and the internal removal sentinel—not sibling privilege leakage or client role spoofing.