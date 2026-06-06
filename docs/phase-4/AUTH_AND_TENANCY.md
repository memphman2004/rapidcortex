# Phase 4 — Authentication and tenant scoping

**Operational auth / RBAC / edge cases:** [../AUTH_OPERATIONS.md](../AUTH_OPERATIONS.md) · **Environment matrix:** [../ENVIRONMENT_MATRIX.md](../ENVIRONMENT_MATRIX.md) · **Deploy:** [../DEPLOYMENT.md](../DEPLOYMENT.md)

## Cognito layer

- **User pool** + **app client** (no secret) defined in [`infra/template.yaml`](../../infra/template.yaml).
- **Custom attributes:** `custom:agencyId`, `custom:role` (mutable string schema).
- **Flows:** `ALLOW_USER_PASSWORD_AUTH` + refresh for MVP; Hosted UI domain resource included for future SSO/OIDC alignment.

## Web (Next.js)

- **Public URL pattern:** **`https://www.rapidcortex.us/<city-town-or-county-slug>/…`** — app routes live under `apps/web/app/[jurisdiction]/` (e.g. `https://www.rapidcortex.us/columbus/dashboard`).
- **Login:** `/<slug>/login` + `app/api/auth/signin` / `signout` / `session` / `refresh-cookies` (see `apps/web/app/api/auth`).
- **JWT validation:** `middleware.ts` reads **HTTP-only** ID token cookie, verifies with Cognito JWKS (`jose` in `lib/auth/verify-cognito.ts`). If the ID JWT is expired but a **refresh** cookie exists, middleware redirects through **`GET /api/auth/refresh-cookies`** to rotate tokens before loading protected routes.
- **Claims → session:** `mapJwtToUser` requires non-empty `custom:agencyId`; `custom:role` normalized to `dispatcher` | `supervisor` | `admin`.

## Route guards (frontend)

Path prefixes below are **after** `/<slug>/` on the www host (e.g. `/columbus/dashboard` → subpath `/dashboard`).

| Prefix | Allowed roles |
|--------|----------------|
| `/dashboard`, `/history`, `/demo` | Authenticated (when auth env set) |
| `/review` | `supervisor`, `admin` |
| `/admin` | `admin` |
| `/login`, `/showcase`, static assets | Public |

When Cognito env vars are **unset**, middleware skips protection so local mock demos work.

## Backend authorization

- **`getUserContext`** from JWT authorizer or forwarded headers (see `apps/api/src/lib/auth.ts`).
- **`TenantAccessGuard` pattern:** services load incident by id and compare `incident.agencyId === user.agencyId` before read/write.
- **Admin routes:** handlers check `user.role === "admin"` before Cognito admin APIs.

## Tenant scoping rules

1. **Every** incident, transcript segment, analysis, and audit row carries **`agencyId`** (or is query-scoped by it).
2. **No cross-tenant reads** — `get(incidentId)` must confirm agency match; list operations use GSI partition `agencyId`.
3. **Admin** actions apply only within the same pool/agency model (MVP: single user pool; users tagged with `custom:agencyId`).

## Exit criteria

- **Login works** with pool client + cookie session.
- Users **only see agency data** on list/get paths.
- **Role gating** in UI (`SideNav`) and API (middleware + handler checks).

## Hardening backlog

- JWT **access** token vs **ID** token strategy for API Gateway authorizer (current BFF may forward ID token — document chosen pattern).
- Refresh rotation, device binding, and **MFA** for CJIS-aligned pilots.
- Automated tests for forbidden cross-agency access.
