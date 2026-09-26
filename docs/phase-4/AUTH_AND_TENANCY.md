# Phase 4 — Authentication and tenant scoping

**Last reviewed:** 2026-09-19 (60-day refresh) · **Owner:** Jeff Coleman  
**Operational auth / RBAC / edge cases:** [AUTH_OPERATIONS.md](../product-architecture/AUTH_OPERATIONS.md) · **Policy:** [POL-03](../security-compliance/soc2/policies/03-access-control-policy.md) · **Environment matrix:** [ENVIRONMENT_MATRIX.md](../deployment-infrastructure/ENVIRONMENT_MATRIX.md) · **Deploy:** [DEPLOYMENT.md](../deployment-infrastructure/DEPLOYMENT.md)

## Cognito layer

- **User pool** + **app client** defined in [`infra/template.yaml`](../../infra/template.yaml).
- **Production pool:** `us-east-1_0z6tA6WBs` — **`MfaConfiguration=ON`** (TOTP required; SMS when Cognito challenges `SMS_MFA`). Evidence: `docs/evidence/soc2-evidence/2026-10/cognito-mfa-config.json` (2026-09-17 snapshot).
- **Custom attributes:** `custom:agencyId`, `custom:role` (mutable string schema). Canonical roles: `packages/shared/src/auth/rapid-cortex-roles.ts` (`normalizeSessionRole()`).
- **Flows:** `ALLOW_USER_PASSWORD_AUTH` + refresh; Hosted UI domain for SSO/OIDC and native PKCE ([native-auth-flow.md](../native-auth-flow.md)).

## Web (Next.js)

- **Public URL pattern:** **`https://www.rapidcortex.us/<city-town-or-county-slug>/…`** — app routes live under `apps/web/app/[jurisdiction]/` (e.g. `https://www.rapidcortex.us/columbus/dashboard`). Production app host: `https://app.rapidcortex.us`.
- **Login:** `/<slug>/login` + `app/api/auth/signin` / `mfa` / `signout` / `session` / `refresh-cookies` (see `apps/web/app/api/auth`). Production users complete **MFA** after password.
- **JWT validation:** `middleware.ts` reads **HTTP-only** ID token cookie, verifies with Cognito JWKS (`jose` in `lib/auth/verify-cognito.ts`). If the ID JWT is expired but a **refresh** cookie exists, middleware redirects through **`GET /api/auth/refresh-cookies`** to rotate tokens before loading protected routes.
- **Claims → session:** `mapJwtToUser` requires non-empty `custom:agencyId`; `custom:role` normalized via `normalizeSessionRole()`.

## Route guards (frontend)

Path prefixes below are **after** `/<slug>/` on the www host (e.g. `/columbus/dashboard` → subpath `/dashboard`).

| Prefix | Allowed roles |
|--------|----------------|
| `/dashboard`, `/history`, `/demo` | Authenticated (when auth env set) |
| `/review` | `supervisor`, agency admin |
| `/admin` | Agency admin roles |
| `/rc-admin` | `rcsuperadmin`, `rcadmin`, `rcitadmin` |
| `/login`, `/showcase`, static assets | Public |

When Cognito env vars are **unset**, middleware skips protection so local mock demos work.

## Backend authorization

- **`getUserContext`** from JWT authorizer or forwarded headers (see `apps/api/src/lib/auth.ts`).
- **`TenantAccessGuard` pattern:** services load incident by id and compare `incident.agencyId === user.agencyId` before read/write. AgencyId is **never** taken from URL parameters for authorization.
- **Admin routes:** handlers check agency-admin or `rc*` roles before Cognito admin APIs.

## Tenant scoping rules

1. **Every** incident, transcript segment, analysis, and audit row carries **`agencyId`** (or is query-scoped by it).
2. **No cross-tenant reads** — `get(incidentId)` must confirm agency match; list operations use GSI partition `agencyId`.
3. **Admin** actions apply only within the same pool/agency model (single user pool; users tagged with `custom:agencyId`). `rcsuperadmin` is the only role exempt from agencyId scoping; every use is auditable.

## Exit criteria

- **Login works** with pool client + cookie session **and MFA** on production.
- Users **only see agency data** on list/get paths.
- **Role gating** in UI (`SideNav`) and API (middleware + handler checks).

## Hardening backlog (not MFA)

MFA on the production pool is **complete** (ON as of 2026-09-17). Remaining:

- JWT **access** token vs **ID** token strategy for API Gateway authorizer (current BFF may forward ID token — document chosen pattern).
- Refresh rotation and lost-device session revoke (same-day per POL-03).
- Automated tests for forbidden cross-agency access.
- SCIM (UM-016) — still roadmap.
