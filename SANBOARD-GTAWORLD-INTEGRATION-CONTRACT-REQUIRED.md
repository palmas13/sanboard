# SANBOARD — GTA World Integration Contract Required

Date: September 26, 2026

Sanboard does not currently possess an official GTA World UCP/API/OAuth contract. The production provider therefore remains fail-closed. The following items must be answered by official documentation or an authorized GTA World integration contact before real login is enabled.

| # | Required contract item | Current answer |
|---|---|---|
| 1 | Authorization URL | **UNKNOWN — official GTA World contract required** |
| 2 | Token URL | **UNKNOWN — official GTA World contract required** |
| 3 | Client authentication method | **UNKNOWN — official GTA World contract required** |
| 4 | Redirect URI rules | **UNKNOWN — official GTA World contract required** |
| 5 | State behavior | **UNKNOWN — official GTA World contract required** |
| 6 | Required scopes | **UNKNOWN — official GTA World contract required** |
| 7 | Account endpoint | **UNKNOWN — official GTA World contract required** |
| 8 | Character endpoint / character list location | **UNKNOWN — official GTA World contract required** |
| 9 | Account ID field | **UNKNOWN — official GTA World contract required** |
| 10 | Character ID field | **UNKNOWN — official GTA World contract required** |
| 11 | ID stability guarantee | **UNKNOWN — official GTA World contract required** |
| 12 | ID global uniqueness guarantee | **UNKNOWN — official GTA World contract required** |
| 13 | Character name fields | **UNKNOWN — official GTA World contract required** |
| 14 | Avatar availability | **UNKNOWN — official GTA World contract required** |
| 15 | Access token lifetime | **UNKNOWN — official GTA World contract required** |
| 16 | Refresh token support | **UNKNOWN — official GTA World contract required** |
| 17 | Token revocation | **UNKNOWN — official GTA World contract required** |
| 18 | Error response format | **UNKNOWN — official GTA World contract required** |
| 19 | Rate limits | **UNKNOWN — official GTA World contract required** |
| 20 | Removed/deleted character semantics | **UNKNOWN — official GTA World contract required** |
| 21 | Character transfer semantics | **UNKNOWN — official GTA World contract required** |
| 22 | Character rename semantics | **UNKNOWN — official GTA World contract required** |
| 23 | Zero-character account behavior | **UNKNOWN — official GTA World contract required** |
| 24 | Suspended/banned UCP account behavior | **UNKNOWN — official GTA World contract required** |

## Required clarifications

- Are account and character IDs strings, numbers, UUIDs, or mixed? Sanboard will treat the confirmed values as opaque strings.
- Is a character ID globally unique across all accounts, or unique only within an account?
- Can a character transfer between accounts? If yes, how is transfer authorization and history represented?
- Can an absent character mean deleted, hidden, inactive, transferred, suspended, or temporarily omitted?
- Is a rename represented by a stable character ID plus changed name fields?
- Can a valid account have zero characters, and should it remain eligible to authenticate at the UCP level?
- Does the authorization response always return `state`, and how are denial/error responses encoded?
- Which callback parameters and HTTP methods are guaranteed? Sanboard will not assume `code`, `state`, query-string delivery, or any alternative until confirmed.

## Activation gate

Real provider implementation must not be enabled until the contract above is reviewed, mapped in adapter tests, and security-reviewed. No mock fallback is an acceptable substitute for missing official answers.