# Authentication and RBAC — pilot operations

Canonical architecture notes: [phase-4/AUTH_AND_TENANCY.md](./phase-4/AUTH_AND_TENANCY.md). This page covers **runtime behavior**, **edge cases**, and **API/UI alignment** after Phase 2–3 hardening.

## Supported flows (pilot)

| Flow | Where implemented | Notes |
|------|-------------------|-------|
| Email + password sign-in | `POST /api/auth/signin` | `USER_PASSWORD_AUTH`; tokens in **httpOnly** cookies when using cookie auth helpers. |
| Refresh | `GET /api/auth/session`, `GET /api/auth/refresh-cookies` | Session route rotates ID/access tokens when refresh cookie is valid. **Middleware** redirects to **`/api/auth/refresh-cookies`** when the ID JWT is expired but refresh remains (cold navigation to protected routes). |
| New password (invite / temp password) | `POST /api/auth/complete-new-password` | Handles `NEW_PASSWORD_REQUIRED` challenge from Cognito. |
| Self-sign-up + confirm | `POST /api/auth/signup`, `POST /api/auth/confirm-signup` | Requires app client configuration and optional client secret in env. |
| Sign out | `POST /api/auth/signout` | Clears cookies. |

## RBAC (roles)

| Role | API pattern | Web middleware |
|------|-------------|----------------|
| `dispatcher` | Tenant-scoped reads/writes on incidents/transcripts per `TenantAccessGuard` / services | `/dashboard`, `/demo`, `/history` |
| `supervisor` | Same tenant + review/analysis paths per services | + `/review` |
| `admin` | + agency admin APIs (users, invites, audit, **integration status**) | + `/admin` |
| `platform_superadmin` | Cross-agency operations where explicitly coded (e.g. `agencyId` query for incidents) | Same as admin for UI; **slug is not a security boundary** |

**Integration status** (`GET /api/integration/status`) is **admin + platform_superadmin** only (deployment-oriented surface).

## Tenant isolation

- JWT drives **`custom:agencyId`** and **`custom:role`**. Services use **`TenantAccessGuard`** / **`AgencyScopeResolver`** for data paths.
- **Cognito admin APIs:** agency **admin** may only **update** or **disable** users whose **`custom:agencyId`** already matches their agency (server verifies target user before `AdminUpdateUserAttributes` / `AdminDisableUser`). Platform superadmin bypasses agency check.
- **User list:** agency admins receive only users in their agency (filtered after `ListUsers`); large pools may need pagination work later.

## Audit (sensitive admin)

These actions write **`admin.user.*`** audit events (agency-scoped, actor id):

- Create / update / deactivate Cognito users via admin API handlers.

## Unsupported or partial flows (documented)

| Topic | Status |
|-------|--------|
| **MFA (TOTP / SMS)** | Not implemented in custom `/api/auth/*` routes. If MFA is required on the pool, sign-in may fail until MFA is disabled for pilot users or Hosted UI flows are adopted. |
| **Social / SAML IdP** | Not in custom routes; use Cognito Hosted UI / federation project if required. |
| **Password reset email** | Use Cognito console / `ForgotPassword` API — no dedicated Next route in-repo; add if product requires self-serve reset. |
| **Machine-to-machine** | API is **JWT-first** (browser BFF or bearer); no API-key auth in template. |

## HTTP semantics

Many handlers return **JSON** bodies with `{ "error": "..." }` while using **HTTP 401/403** only where wired; some legacy paths return **200** with an error field. Clients should read **both** `status` and JSON `error`. Prefer updating callers to treat **401** session expiry as “retry session or re-login.”
