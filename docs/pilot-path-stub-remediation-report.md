# Pilot-Path Stub Remediation Report (April 29, 2026)

Purpose: summarize previously brittle “not configured” branches on **pilot-critical** surfaces and describe how each was hardened for a controlled read-only / shadow deployment.

Legend:

- **A** — Replaced by a guarded or production-safe implementation exposed through existing routes.
- **B** — Replaced / augmented with graceful `{ ok: false, status: \"disabled\", reason: \"SERVICE_NOT_CONFIGURED\", ... }` payloads (HTTP **200**) so SPA shells do not throw unhandled 501 explosions when integrations are intentionally absent.

| Area | Location | Prior behavior | Resolution |
|---|---|---|---|
| CAD unknown GET branches | `apps/web/app/api/cad/[[...segments]]/route.ts` | Returned `configuration_required` / marketing copy depending on caller path — potential confusion for exploratory segments. | **B** unified `SERVICE_NOT_CONFIGURED` response via `serviceNotConfiguredPilotResponse` for non-CAD-covered GET tails. Canonical read endpoints (`health`, `/incidents`, `/active-incidents`, `/units`, `/events/recent`) use `StagingCadReadAdapter`/`MotorolaCadReadAdapter`. |
| CAD write POST verbs | Same file | Wrapped `notConfigured` contract exclusively. | **A** hardened gate: rejects unless env flag `CAD_WRITEBACK_ENABLED==="true"`; otherwise HTTP **403** with explicit disabled message + Dynamo audit insertion via Lambda `POST /api/security/cad-writeback-blocked`. |
| Incident intake proxies | `apps/web/app/api/intake/session/**` | Previously stubbed upstream; today forwards with `proxyToAuthUpstream`. | **A** If upstream unreachable, proxies surface HTTP errors without Next crash (verify runbook). Smoke script treats anon 401/5xx gracefully. |
| Transcription proxies | `apps/web/app/api/transcription/**` | Upstream proxies. | **A** Verified contract via smoke harness (anonymous safe handling). |
| Translation proxies | `apps/web/app/api/language/**` | Upstream proxies. | **A** Verified contract via smoke harness. |
| Supervisor dashboard surrogate | `apps/web/app/api/dashboard/summary/route.ts` | Served mock payloads with auth RBAC guards. | **A** Stable JSON + 401 rejection without cookie (smoke-tested). |
| SMS provider factory internals | `apps/api/src/services/sms/smsProviderFactory.ts` | Local `notConfiguredTwilio()` helper unrelated to SPA router contracts. | **No change required** — not a routing stub; outbound SMS guarded elsewhere. |

## Residual exploratory routes

- **`apps/web/lib/rc-lite/v1-handle.ts`** — Returns HTTP **501** by design until RC Lite workers connect. Not part of the primary pilot SPA path; flagged for future service-disabled harmonization **only** if surfaced to production users.
- **Marketing/developer docs** referencing `501` — Documentation only.

## Operational follow-ups

- Run `npm run pilot:smoke` with staging credentials (`PILOT_API_BASE`, `PILOT_WEB_BASE`, cookie / bearer probes) ahead of pilot kickoff.
