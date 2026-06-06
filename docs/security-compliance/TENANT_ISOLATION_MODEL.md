# Tenant isolation model

## Source of truth for identity

1. **Cognito ID token** (Bearer) or **HTTP API JWT authorizer** claims — mapped in `apps/api/src/lib/auth.ts` to `UserContext`.
2. **`custom:agencyId` and `custom:role`** must come **only** from verified JWT claims — never trust copies in JSON bodies for authorization decisions.
3. **Platform superadmin** uses a sentinel agency id (`PLATFORM_AGENCY_ID`) with explicit superadmin checks for cross-tenant operations.

## Enforcement layers

| Layer | Responsibility |
|-------|------------------|
| Lambda handler | `getUserContext` → `unauthorized` if missing; role checks (`AuthorizationService`, etc.) |
| Services | `IncidentService`, `AgencyService`, media services resolve target resource then **`TenantAccessGuard` / `AgencyScopeResolver`** patterns from `rapid-cortex-security` |
| DynamoDB access | Keys and `ConditionExpression` / filter expressions that include `agencyId` where applicable |
| S3 presign | Validate incident ownership and agency match before signing |

## Deny by default

- Unknown routes → API Gateway 403/404 depending on configuration.
- Missing JWT on protected routes → **401**.
- JWT present but wrong tenant / role → **403** (or **404** where anti-enumeration is chosen for resource existence).

## Anti-enumeration

- For some incident reads, wrong-tenant and not-found may both return **403** — see security tests under `apps/api/src/__tests__/security/cross-tenant-isolation.test.ts`.

## Tests

- `cross-tenant-isolation.test.ts` — agency A cannot read agency B incidents; forged `agencyId` query ignored for non-superadmin.
- `permission-escalation.test.ts`, `token-abuse.test.ts`, `rate-limiting.test.ts` — complementary controls.

## Web BFF (`apps/web/app/api/**`)

- Cookie-based session must **verify** Cognito ID token server-side before proxying to upstream API.
- Any optional `agencyId` query (e.g. dashboard summary) must be validated against JWT tenant (`assertDashboardAgencyScope` pattern).
