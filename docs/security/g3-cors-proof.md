# G3 Evidence — CORS Approved Origins

> **G3 customer gate:** **[`customer-readiness-gate.md`](../customer-readiness-gate.md)** — **YELLOW**: code and IaC controls have advanced; **environment-specific PASS evidence** and **reviewer signoffs** are still required in the **target** environment. **Code + IaC progress does not replace environment-specific proof.** **Do not** mark G3 GREEN from code, IaC, local tests, or intended configuration alone. Master rollup: [`g3-security-controls-platform.md`](./g3-security-controls-platform.md).

**Status:** PARTIAL — infra + Lambda helpers centralized; browsers still rely primarily on HTTP API `CorsConfiguration`.

## Sources of truth

| Layer | Mechanism |
|---|---|
| SAM HTTP API | `infra/template.yaml` → `HttpApi` `CorsConfiguration.AllowOrigins: !Split [",", !Ref HttpApiCorsAllowedOrigins]` |
| SAM guardrail | Rules `PilotProdNoCorsWildcard` forbids wildcard in pilot/staging/prod |
| Lambda echo | `Globals.Function.Variables.APPROVED_CORS_ORIGINS: !Ref HttpApiCorsAllowedOrigins` + `apps/api/src/security/cors-origin.ts` |
| Next.js shell | Browser CSRF/origin guards in `apps/web/lib/csrf.ts` (`APP_ALLOWED_ORIGINS`, `NEXT_PUBLIC_SITE_URL`) |

## Environment variable

- **`APPROVED_CORS_ORIGINS`** — comma-separated list (mirrors stack parameter at deploy time).

## Forbidden in production stacks

Wildcard `*` is blocked by SAM assertions for staged production-like environments (`PilotProdNoCorsWildcard`).

## curl checks (staging)

Replace `API` and origins:

```bash
API=https://REPLACE.execute-api.region.amazonaws.com
ORIG_OK=https://app.customer.example.com
ORIG_BAD=https://evil.example.com

curl -si -X OPTIONS "$API/api/billing/square/webhook" \
  -H "Origin: $ORIG_OK" -H "Access-Control-Request-Method: POST" | rg -i "access-control"

curl -si -X OPTIONS "$API/api/billing/square/webhook" \
  -H "Origin: $ORIG_BAD" -H "Access-Control-Request-Method: POST" | rg -i "access-control"
```

Expected: approved origin returns `Access-Control-Allow-Origin` echo; unknown origin omits allow header (browser blocks).
