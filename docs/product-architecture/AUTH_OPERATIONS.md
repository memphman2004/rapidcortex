# Authentication and RBAC — pilot operations

**Last reviewed:** 2026-09-19 (60-day refresh) · **Owner:** Jeff Coleman  
**Canonical architecture notes:** [phase-4/AUTH_AND_TENANCY.md](../phase-4/AUTH_AND_TENANCY.md). Policy: [POL-03](../security-compliance/soc2/policies/03-access-control-policy.md). Native desktop: [native-auth-flow.md](../native-auth-flow.md).

## Supported flows (pilot)

| Flow | Where implemented | Notes |
|------|-------------------|-------|
| Email + password sign-in | `POST /api/auth/signin` | `USER_PASSWORD_AUTH`; tokens in **httpOnly** cookies when using cookie auth helpers. |
| **MFA (required on production)** | `POST /api/auth/mfa/*` + Cognito pool MFA | Production pool `us-east-1_0z6tA6WBs` is **`MfaConfiguration=ON`** (evidence 2026-09-17). Software **TOTP** setup and login challenges on custom `/api/auth/*` routes. **SMS MFA** when Cognito returns `SMS_MFA`. Agencies own device possession (CUEC). Staging pools may differ. |
| Campus / university SSO (Shibboleth, Azure AD, Duo) | `GET /api/auth/hosted-ui/start` → Cognito Hosted UI → `GET /api/auth/hosted-ui/callback` | Federated login path. MFA is enforced at the **IdP**; Cognito MFA still applies to password users on the production pool. JIT uses `custom:agencyId` + `custom:role`. See [CAMPUS_SSO_HOSTED_UI.md](./CAMPUS_SSO_HOSTED_UI.md). SCIM is Roadmap. |
| Refresh | `GET /api/auth/session`, `GET /api/auth/refresh-cookies` | Session route rotates ID/access tokens when refresh cookie is valid. **Middleware** redirects to **`/api/auth/refresh-cookies`** when the ID JWT is expired but refresh remains. |
| New password (invite / temp password) | `POST /api/auth/complete-new-password` | Handles `NEW_PASSWORD_REQUIRED` challenge from Cognito. MFA enrollment follows password set on production. |
| Self-sign-up + confirm | `POST /api/auth/signup`, `POST /api/auth/confirm-signup` | Requires app client configuration. **Off** on production unless a ticket enables it (`NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP`). |
| Sign out | `POST /api/auth/signout` | Clears cookies. |
| Native desktop (PKCE) | `/api/auth/native/token` | Same production pool + MFA as web. See [native-auth-flow.md](../native-auth-flow.md). |

## RBAC (roles)

Canonical values: `packages/shared/src/auth/rapid-cortex-roles.ts`. Call `normalizeSessionRole()` before any PSAP migration. Legacy `platform_superadmin` → `rcsuperadmin`; `commsupervisor` → `supervisor`.

| Role | API pattern | Web middleware |
|------|-------------|----------------|
| `dispatcher` | Tenant-scoped reads/writes on incidents/transcripts per `TenantAccessGuard` / services | `/dashboard`, `/demo`, `/history` |
| `supervisor` | Same tenant + review/analysis paths | + `/review` |
| `agencyadmin` / `admin` (normalized) | Agency admin APIs (users, invites, audit, **integration status**) | + `/admin` |
| `rcsuperadmin` | Cross-agency operations where explicitly coded; **only** role exempt from agencyId scoping | `/rc-admin` — slug is **not** a security boundary |
| `rcadmin` / `rcitadmin` | Platform operators; privileged for Cognito/IAM reviews | `/rc-admin` |

**Integration status** (`GET /api/integration/status`) is **agency admin + platform (`rc*`)** only (deployment-oriented surface).

Privileged access (`rcsuperadmin`, `rcadmin`, `rcitadmin`, plus IAM that can deploy `rapid-cortex-dev`) is reviewed **quarterly** ([access-review.md](../security-compliance/soc2/processes/access-review.md)).

## Tenant isolation

- JWT drives **`custom:agencyId`** and **`custom:role`**. Services use **`TenantAccessGuard`** / **`AgencyScopeResolver`** for data paths. AgencyId is **never** taken from URL parameters for authorization.
- **Cognito admin APIs:** agency **admin** may only **update** or **disable** users whose **`custom:agencyId`** already matches their agency (server verifies target user before `AdminUpdateUserAttributes` / `AdminDisableUser`). `rcsuperadmin` bypasses agency check; every use is auditable.
- **User list:** agency admins receive only users in their agency (filtered after `ListUsers`); large pools may need pagination work later.

## Audit (sensitive admin)

These actions write **`admin.user.*`** audit events (agency-scoped, actor id):

- Create / update / deactivate Cognito users via admin API handlers.

## Unsupported or partial flows (documented)

| Topic | Status |
|-------|--------|
| **MFA (TOTP / SMS)** | **Required** on the production Cognito pool. Custom `/api/auth/mfa/*` routes handle challenges. Campus / university federation still enforces MFA at the IdP via Hosted UI. |
| **Social / SAML IdP** | Not in custom password routes. Use Cognito Hosted UI federation ([CAMPUS_SSO_HOSTED_UI.md](./CAMPUS_SSO_HOSTED_UI.md)). Do not add a SAML IdP name to the app client until the IdP resource exists. |
| **SCIM (UM-016)** | Roadmap. Use JIT claims + admin disable until SCIM is delivered. |
| **Password reset email** | Use Cognito console / `ForgotPassword` API — no dedicated Next route in-repo; add if product requires self-serve reset. |
| **Machine-to-machine** | API is **JWT-first** (browser BFF or bearer); no API-key auth in template. |

## HTTP semantics

Many handlers return **JSON** bodies with `{ "error": "..." }` while using **HTTP 401/403** only where wired; some legacy paths return **200** with an error field. Clients should read **both** `status` and JSON `error`. Prefer updating callers to treat **401** session expiry as “retry session or re-login.”
