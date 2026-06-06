# Security hardening audit (Rapid Cortex)

**Scope:** Web app (`apps/web`), API Lambdas (`apps/api`), shared packages, SAM template (`infra/template.yaml`).  
**Posture:** CJIS-aligned and SOC 2–ready **controls** — not certifications. This document describes production hardening and breach-risk reduction, not a guarantee of compliance.

## Summary

| Area | Status |
|------|--------|
| AuthN / AuthZ | Cognito JWT (Bearer + API Gateway authorizer claims); `ALLOW_UNAUTHENTICATED_API` fail-closed outside development |
| Tenant isolation | `rapid-cortex-security` + services enforce `agencyId` from JWT; cross-tenant tests exist |
| Client validation leakage | **Fixed:** Zod failures use `badRequestFromZod` / `validationErrorMessageForClient` — generic `"Invalid request"` in production |
| Unauthenticated schema probe | **Fixed:** `createIncident` validates JWT **before** body schema |
| Correlation IDs | **Added:** `X-Request-Id` on `getIncident` responses (pattern for other handlers) |
| Safe logging helpers | **Added:** `apps/api/src/lib/safe-log.ts` (redaction + structured security audit line) |
| S3 assets bucket | **Hardened:** SSE-S3 default encryption + full public access block on `AssetsBucket` |
| Aggregate analytics Lambda | **Hardened:** rejects HTTP-shaped invocations (404); remains schedule-only in SAM |
| Secrets in repo | **Added:** `npm run security:scan-secrets` |
| `.env.example` | **Git:** `!.env.example` so tracked template is not ignored by `.env*` |
| Signup errors | **Hardened:** production returns generic copy (no raw SDK messages) |
| Browser storage | **Adjusted:** admin onboarding UI uses `sessionStorage` (non-sensitive) instead of `localStorage` |
| CSP | **Optional enforcement:** `NEXT_PUBLIC_CSP_ENFORCE=1` sets `Content-Security-Policy` (else report-only) |

## What was found (representative)

1. **Zod `.message` in JSON 400 responses** — leaks field names and validation shape to any caller, including unauthenticated clients on handlers that parsed before auth.
2. **`createIncident` parsed body before `getUserContext`** — allowed anonymous validation fingerprinting.
3. **`POST` signup catch** returned `err.message` — could expose Cognito/SDK strings.
4. **`AssetsBucket`** lacked explicit encryption + public access block in template (relying on account defaults is weaker than explicit deny).
5. **`aggregateAnalytics`** had no HTTP route in SAM but handler type allowed API Gateway shape — future misconfiguration risk.
6. **No repo-local secret scan** in npm scripts (relied on manual review).
7. **Correlation IDs** not consistently returned on API JSON responses.

## Remaining risks (prioritize next)

| Risk | Mitigation (not all implemented here) |
|------|----------------------------------------|
| Upstream proxy responses (`apps/web` BFF) may echo upstream bodies | Validate / map errors in BFF; strip internal fields |
| Not all handlers wrap responses with `withCorrelationHeaders` | Roll pattern across hot paths + add ALB/API GW access logs with `requestId` |
| `badRequest("literal")` still returns specific messages | Review for information disclosure vs 400 generic |
| AI prompt injection / exfiltration | Provider allowlists, tool-less modes, prompt boundaries — see `docs/CJIS_ALIGNMENT_NOTES.md` |
| WAF / rate limits | API Gateway + WAFv2 — document only in checklist until wired |
| Malware scanning on uploads | Extension points in checklist; ClamAV / async quarantine pattern |
| Full CSP enforcement | Enable `NEXT_PUBLIC_CSP_ENFORCE=1` after violation burn-in from report-only |

## Files changed (this pass)

- `apps/api/src/lib/response.ts`, `zod-client-error.ts`, `correlation.ts`, `safe-log.ts`
- `apps/api/src/handlers/**/*.ts` — Zod responses + Prettier (bulk)
- `apps/api/src/handlers/createIncident.ts` — auth order
- `apps/api/src/handlers/getIncident.ts` — correlation headers
- `apps/api/src/handlers/analytics/aggregateAnalytics.ts` — HTTP deny
- `apps/api/src/__tests__/security/validation-client-surface.test.ts`, `aggregate-analytics-http-deny.test.ts`
- `apps/api/src/handlers/createIncident.handler.integration.test.ts`
- `apps/web/app/api/auth/signup/route.ts`
- `apps/web/next.config.ts` — optional CSP enforce
- `apps/web/components/admin/*-tracker.tsx` — sessionStorage
- `infra/template.yaml` — `AssetsBucket` encryption + public access block
- `scripts/check-repo-secrets.mjs`, `package.json`, `.gitignore`

## Tests added / updated

- `validation-client-surface.test.ts` — production Zod message hiding
- `aggregate-analytics-http-deny.test.ts` — HTTP-shaped invoke → 404
- `createIncident.handler.integration.test.ts` — unauthenticated → 401 before schema feedback
- `token-abuse.test.ts` — confirm-upload payload aligned with strict `incidentMediaConfirmBodySchema` (removed obsolete `fileName` field)

**Commands**

```bash
npm run typecheck
npm run lint:web
npm run test:security
npm run security:scan-secrets
npm run security:audit
npm run build
```

**Latest verification (this change set):** `typecheck`, `lint:web` (0 errors; 10 pre-existing warnings), `test:security` (20/20), `security:scan-secrets`, `npm audit --audit-level=high` (exit 0; **12 moderate** transitive issues reported — mostly Expo-related dev tooling; review `npm audit` full output before `npm audit fix --force`).

**Lint fix bundled:** `apps/web/app/(marketing)/terms/page.tsx` internal policy link now uses `next/link` (resolves `@next/next/no-html-link-for-pages` errors).

## Manual AWS steps (operators)

1. **Secrets:** Store provider keys in Secrets Manager / SSM; reference from SAM parameters (already supported for many keys in `template.yaml`).
2. **CORS:** Set `HttpApiCorsAllowedOrigins` to explicit origins in prod (avoid `*`).
3. **WAF:** Attach WAFv2 web ACL to API Gateway / CloudFront — rate limit, AWS Managed Rules, optional geo allowlist.
4. **CloudTrail / GuardDuty / Security Hub / Config:** Enable organization-wide; align retention to legal policy (template includes hardened CloudTrail bucket pattern).
5. **CSP:** After report-only review, set `NEXT_PUBLIC_CSP_ENFORCE=1` on the web deployment.
6. **Macie:** Enable for S3 buckets holding sensitive media if account policy allows.

## Related documents

- `docs/DATA_PROTECTION_MODEL.md`
- `docs/TENANT_ISOLATION_MODEL.md`
- `docs/INCIDENT_RESPONSE_RUNBOOK.md`
- `docs/PRODUCTION_SECURITY_CHECKLIST.md`
- `docs/CJIS_ALIGNMENT_NOTES.md`
