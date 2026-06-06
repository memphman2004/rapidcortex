# G3 Evidence — JWT Authorizer & Session Validation

> **G3 customer gate:** **[`customer-readiness-gate.md`](../customer-readiness-gate.md)** — **YELLOW**: code and IaC controls have advanced; **environment-specific PASS evidence** and **reviewer signoffs** are still required in the **target** environment. **Code + IaC progress does not replace environment-specific proof.** **Do not** mark G3 GREEN from code, IaC, local tests, or intended configuration alone. Master rollup: [`g3-security-controls-platform.md`](./g3-security-controls-platform.md).

**Status:** PARTIAL — codepaths documented; penetration test exports remain **manual**.

## API Gateway JWT

`infra/template.yaml` → HTTP API **default authorizer** `CognitoJwtAuthorizer`:

- Issuer `https://cognito-idp.${Region}.amazonaws.com/${Pool}`
- Audience = app client ID

Routes without `Auth: NONE` require `Authorization: Bearer <id-token>` matching pool configuration.

Anonymous routes (health, webhook callbacks, SMS join links, etc.) are explicitly marked **`Auth: NONE`** — see SAM per-route `Events`.

## Lambda `getUserContext`

Handlers import `apps/api/src/lib/auth.ts`:

- Bearer ID token validated against JWKS + audience/client id.
- Inactive accounts rejected (`custom:status` inactive path).

## Tenant isolation

Security package `TenantAccessGuard` / `AuthorizationService` used in media, QA, dispatcher surfaces — repository queries filter **agencyId**.

## Smoke tests

- `tsx scripts/g3-security-smoke-test.ts` — unauthenticated rejection on `/api/me`.
- Deeper tenancy matrix requires **two JWT fixtures** (`TEST_JWT`, `TEST_AGENCY_ID`, `CROSS_TENANT_*` placeholders).
