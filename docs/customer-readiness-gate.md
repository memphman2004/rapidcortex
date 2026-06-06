# Rapid Cortex Customer Readiness Gate Sheet

## 1. Document Control

- **Customer / Agency:**
- **Deployment Type:**
- **Environment:**
- **Release Version / Commit:**
- **Prepared By:**
- **Review Date:**
- **Target Pilot Date:**
- **Target Production Date:**
- **Overall Status:** YELLOW (read-only pilot) per §2 — change to GREEN only after §8 exit criteria and §5 evidence/sign-offs.
- **Final Decision:**
- **Executive Sponsor:**
- **Engineering Owner:**
- **Security Owner:**
- **Customer Owner:**

## 2. Current Recommendation

**Current Recommendation:** YELLOW — proceed only with scoped pilot.  
**Hard Stop:** NO-GO for production CAD write-back.

Rapid Cortex may proceed with a tightly scoped read-only/shadow pilot only when all P0 pilot gates pass. Full production rollout and CAD write-back require separate approval.

### Current Check Snapshot (2026-04-29)

- **Project-wide decision:** YELLOW (conditional go for one-customer read-only/shadow pilot)
- **Production CAD write-back:** RED (hard no-go)
- **Key evidence from repository scan:**
  - CAD adapter mode defaults to disabled **or** deterministic read-only scaffolding via `StagingCadReadAdapter` when `CAD_INTEGRATION_MODE=read_only` (see `apps/web/lib/rapid-cortex/cad/`).
  - Pilot-path stubs on core proxy routes were replaced with authenticated upstream proxies; CAD write verbs now use an explicit operational gate (`CAD_WRITEBACK_ENABLED`) rather than latent `configuration_required` payloads.
  - Security/audit/webhook capabilities exist in API services and tests: `apps/api/src/services/externalV1Dispatcher.ts`, `apps/api/src/services/webhookDeliveryService.ts`, `apps/api/src/lib/webhookSecretEncryption.ts`, `apps/api/src/repositories/auditRepository.ts`.
  - Multilingual text path: central language registry (100+ codes), provider-backed `GET /api/call-intelligence/languages`, Azure Translator → Google Translate orchestration for dispatcher/silent-text flows — see [`docs/languages/supported-call-languages.md`](./languages/supported-call-languages.md) and [`docs/languages/911-language-fallback-reliability.md`](./languages/911-language-fallback-reliability.md) (operator narrative; not a security GREEN claim).
  - **Repository automation (not gate closure):** `npm run test:g1`, `npm run test:g2`, `npm run validate:all-gates`, and [`docs/evidence/templates/`](./evidence/templates/README.md) support evidence collection; they do **not** substitute for staging/production proof or sign-off (see §5A).

### Current Remediation Status (2026-04-29)

| Area | Status | Notes |
|---|---|---|
| CAD read-only adapter | **COMPLETE** (`StagingCadReadAdapter` + optional Motorola read facade) — see `StagingCadReadAdapter` and CAD routes. | Controlled mock data activates automatically for `CAD_INTEGRATION_MODE=read_only` without Motorola branding. |
| CAD write-back | **INTENTIONALLY DISABLED FOR PILOT** (`CAD_WRITEBACK_ENABLED` literal gate + Dynamo audit Lambda). | Fail-closed by default (`undefined` behaves as blocked). Never enable real vendor write adapters in-repo without contractual approval. |
| `notConfigured` pilot-path stubs | **REMEDIATED (PARTIAL residual)** — see `docs/pilot-path-stub-remediation-report.md`. | Exploratory routes now return graceful `SERVICE_NOT_CONFIGURED` JSON tails; integrations continue to degrade without crashing shell routes. |
| Security/ops evidence package | **`docs/security-ops-evidence-package.md` CREATED — PENDING MANUAL PROOF.** | Operational truth still requires AWS/console attachments — document template only. |
| Desktop hardening | **`docs/desktop-hardening-checklist.md` CREATED — BLOCKED FOR BROAD ROLLOUT UNTIL SIGNING/SESSION HARDENING COMPLETE.** | Pilot may remain web-first; desktops remain optional. |

**Final readiness verdict (aggregate):**

- **YELLOW — Conditional go** for **one-agency web read-only / shadow pilot**.
- **RED / explicit NO-GO** for production **CAD write-back** integrations.

### IaC deployment architecture (nested stacks — 2026-04)

- **SAM / CloudFormation size limit unblock:** Production deploys previously failed when the SAM transform exceeded the roughly **1 MB** transformed-template limit. Rapid Cortex IaC now uses a **root stack** (`infra/template.yaml`) with **nested stacks** (`infra/nested/stack-data-layer.yaml` for DynamoDB/S3/multilingual billing secrets + `infra/nested/stack-app-sam.yaml` for the SAM application layer). Preflight sizing: `./scripts/infra-template-size-check.sh`.
- **This is a deployment architecture fix only.** It does **not** change the **YELLOW** customer gate, **YELLOW** G3 posture, CAD write-back **disabled-by-default** policy, or substitute for environment-specific evidence and sign-offs.

### Immediate Issues and Required Fixes

- **Issue:** Real CAD vendor adapter is not implemented end-to-end.  
  **Fix required:** Implement and validate one vendor read adapter in staging, then pilot.
- **Issue:** CAD write path is intentionally blocked/placeholder.  
  **Fix required:** Keep disabled for pilot; do not change until write-back hard gate is passed.
- **Issue:** Remaining `notConfigured` stubs can break pilot flow.  
  **Fix required:** Replace pilot-path stubs and run pilot smoke tests.
- **Issue:** Evidence package is incomplete for security/ops sign-off.  
  **Fix required:** Attach proof for CORS, WAF, secrets, alarms, rollback drill, and audit scenarios.
- **Issue:** Desktop hardening incomplete for broad rollout.  
  **Fix required:** Complete signing/notarization/session hardening before expansion beyond pilot.

### `notConfigured` Route Triage (Critical Pilot Path)

The identified `notConfigured` pilot-path routes (including language/CAD/media/command surfaces) were reviewed against the first-customer read-only pilot journey (login → CAD read visibility → triage/summarize → transcription/translation → intake/session continuity → audit/alarms).

| Priority | Route File | Pilot Path Criticality | Owner | Effort | Status | Notes |
|---|---|---|---|---|---|---|
| P0 | `apps/web/app/api/cad/[[...segments]]/route.ts` | Critical | Integrations + Backend | M | Substantially complete | `GET /health`, richer read surfaces (`incidents`, `active-incidents`, `units`, `events/recent`) backed by staging / Motorola adapters; write paths hard-gated (`CAD_WRITEBACK_ENABLED`). |
| P0 | `apps/web/app/api/triage/analyze/route.ts` | Critical | AI/Backend + Web | S | Fixed | Replaced `notConfigured` with authenticated upstream proxy to `/api/triage/analyze`. |
| P0 | `apps/web/app/api/transcription/start/route.ts` | Critical | Voice/Backend + Web | S | Fixed | Replaced `notConfigured` with authenticated upstream proxy to `/api/transcription/start`. |
| P0 | `apps/web/app/api/transcription/stop/route.ts` | Critical | Voice/Backend + Web | S | Fixed | Replaced `notConfigured` with authenticated upstream proxy to `/api/transcription/stop`. |
| P0 | `apps/web/app/api/language/translate/route.ts` | Critical | Language/Backend + Web | S | Fixed | Replaced `notConfigured` with authenticated upstream proxy to `/api/language/translate`. |
| P0 | `apps/web/app/api/language/detect/route.ts` | Critical | Language/Backend + Web | S | Fixed | Replaced `notConfigured` with authenticated upstream proxy to `/api/language/detect`. |
| P0 | `apps/web/app/api/call-intelligence/languages/route.ts` | Critical | Language/Backend + Web | S | Fixed | Authenticated upstream proxy to `GET /api/call-intelligence/languages` (provider-backed language directory for dispatch UI). |
| P0 | `apps/web/app/api/intake/session/route.ts` | Critical | Intake/Backend + Web | S | Fixed | Replaced `notConfigured` with authenticated upstream proxy to `/api/intake/session`. |
| P0 | `apps/web/app/api/intake/session/[id]/route.ts` | Critical | Intake/Backend + Web | S | Fixed | Replaced `notConfigured` with authenticated upstream proxy to `/api/intake/session/:id`. |
| P1 | `apps/web/app/api/media/[[...segments]]/route.ts` | Non-critical for initial read-only pilot | Media Team | M | Fixed | Replaced `notConfigured` with authenticated upstream proxy for GET/POST/PATCH media paths. |
| P1 | `apps/web/app/api/command/[[...segments]]/route.ts` | Non-critical for initial read-only pilot | Command Center Team | M | Fixed | Replaced `notConfigured` with authenticated upstream proxy for command routes. |
| P1 | `apps/web/app/api/qa/[[...segments]]/route.ts` | Non-critical for initial read-only pilot | QA Product Team | M | Fixed | Replaced `notConfigured` with authenticated upstream proxy for QA routes. |
| P1 | `apps/web/app/api/reliability/[[...segments]]/route.ts` | Non-critical for initial read-only pilot | SRE/Platform | M | Fixed | Replaced `notConfigured` with authenticated upstream proxy for reliability routes. |
| P2 | `apps/web/app/api/language/text-to-voice/route.ts` | Optional for initial read-only pilot | Language/Voice Team | S | Fixed | Replaced `notConfigured` with authenticated upstream proxy for text-to-voice route. |

**Residual exploratory gaps:** unmatched CAD GET tails return `SERVICE_NOT_CONFIGURED`; CAD POST tails remain gated (see write-back Lambda). Optional RC Lite placeholders outside the pilot SPA still return HTTP **501**.

### Production Readiness Remaining Work (Prioritized)

| Priority | File / Area | Owner | Effort | Remaining Work |
|---|---|---|---|---|
| P0 | CAD write telemetry & audit dashboards | Integrations + Security | M | Operationalize Dynamo queries for `cad.writeback.blocked` events emitted by `/api/security/cad-writeback-blocked`. Attach smoke artifacts from `npm run pilot:smoke`. |
| P0 | Vendor CAD adapter implementation (`apps/web/lib/rapid-cortex/cad/*` + upstream service) | Integrations + Backend | L | Implement one real vendor read adapter end-to-end and validate negative-path safety/retry behavior. |
| P0 | Security/ops evidence package (`docs/deployment-infrastructure/*`) | Security + Platform + Ops | M | Attach WAF, CORS, secrets, alarms, rollback drill, and audit scenario evidence for release sign-off. |
| P1 | Desktop hardening (`apps/desktop-macos/*`, `docs/desktop/*`) | Desktop + Security | M | Complete signing/notarization/session hardening prior to broad rollout. |

## 3. Gate Definitions

**GREEN:**  
All P0 gates pass, no unresolved security, tenancy, or write-risk items remain, and the deployment is approved for the defined production scope.

**YELLOW:**  
P0 gates pass for the approved read-only pilot scope. P1 gaps are tracked with named owners, dates, mitigations, and customer-facing limitations.

**RED:**  
Any P0 failure exists in authentication, tenant isolation, security controls, CAD integration safety, auditability, rollback capability, or incident response.

**Current baseline:**  
YELLOW for read-only pilot.  
RED for full production CAD write integration.

**CJI handling for this deployment:** [YES / NO — decision required before final sign-off]
- If **YES**: complete CJIS compliance items and attach evidence before production approval.
- If **NO**: CJIS section may be marked not applicable with security owner sign-off.

## 4. Scope Decision

- [ ] Read-only / shadow pilot
- [ ] Limited production pilot
- [ ] Full production dashboard rollout
- [ ] RC Lite API-only pilot
- [ ] RC Lite production API access
- [ ] CAD read integration
- [ ] CAD write-back integration
- [ ] Desktop connector rollout
- [ ] Mobile / field responder rollout

**Scope notes:**
- **Approved scope:**
- **Explicitly excluded scope:**
- **Customer-facing limitations:**
- **Required customer approvals:**

## 4A. CJIS Compliance Gate (Conditional, Required If CJI = YES)

- [ ] CJIS applicability confirmed by Security Owner and Customer Owner.
- [ ] CJI data flow diagram approved and retained with deployment record.
- [ ] Access control model validated for least privilege and agency boundaries.
- [ ] Audit trail retention and export procedures reviewed for CJIS requirements.
- [ ] Encryption in transit and at rest verified for CJI data stores.
- [ ] Incident response and breach notification workflow validated for CJI scenarios.
- [ ] Vendor/subprocessor compliance status documented where applicable.

**Owner:**  
**Target Date:**  
**Evidence Link:**  
**Signoff:**

## 5. P0 Gates — Must Pass

> **YELLOW is not production approval.** A gate marked **YELLOW** indicates partial implementation, incomplete evidence package, mitigation in place for pilot/staging, or suitability for **internal/testing** only—not an endorsement for unrestricted production rollout. **Production** requires **GREEN** gates with dated evidence links and documented signoff unless an explicit deviation is negotiated and tracked as risk.

Gate status rules:

- **RED** means the gate **blocks** pilot or production use until closed or materially mitigated.
- **YELLOW** means the gate is **partially** implemented, **awaiting evidence**, or only demonstrated safe for **staging / internal testing** subject to documented limitations.
- **GREEN** means the gate has **implementation proof**, **test evidence**, **assigned owner review**, and **written signoff**.
- **CAD write-back** cannot move out of **RED** unless there is **documented approval** from **the agency**, **CAD vendor / integration owner**, **security owner**, and **release owner**.

| Gate ID | Gate | Plain-language definition | Recommended status | Owner | Target date | Evidence link | Pending signoff |
|---|---|---|---|---|---|---|---|
| **G1** | Tenant isolation & authentication | Ensures identities, JWT claims, RBAC/entitlements, and agency tenancy prevent cross-agency reads or writes—including dashboard shells, upstream API routes, RC Lite segregation, and superadmin tooling. Blocks anonymous access paths that should fail closed. | YELLOW — core exists; in-repo Vitest matrix + cross-tenant tests; live JWT/penetration evidence still pending | *Assign engineering + security owners* | *YYYY-MM-DD* | Repo: [`jwt-validation.test.ts`](../apps/api/src/__tests__/security/jwt-validation.test.ts), [`cross-tenant-isolation.test.ts`](../apps/api/src/__tests__/security/cross-tenant-isolation.test.ts) · Template: [`g1-tenant-isolation-evidence.template.md`](./evidence/templates/g1-tenant-isolation-evidence.template.md) | Pending |
| **G2** | CAD integration safety — **read scope only** | Read-only adapters and Next/API routes behave safely—timeouts, outages, malformed data, credential errors. Only approved read previews are enabled for shadow pilot; dashboards tolerate upstream absence. Assisted/automated **write-back is out of scope** here—see **G6**. | YELLOW — staging adapter + integration tests in repo; vendor staging/pilot evidence still pending | *Assign integrations owner* | *YYYY-MM-DD* | Repo: [`adapter-integration.test.ts`](../apps/web/lib/rapid-cortex/cad/__tests__/adapter-integration.test.ts) · Template: [`g2-cad-integration-safety-evidence.template.md`](./evidence/templates/g2-cad-integration-safety-evidence.template.md) · Smoke: `npm run pilot:smoke` | Pending |
| **G3** | Security controls (platform) | Secrets never ship in client bundles, logging avoids sensitive spill, infra uses approved secret stores; WAF / CORS / JWT hardening **proved per environment**; integrations validate signatures/webhooks/IAM scopes; encryption enforced in transit/at rest according to posture. | **YELLOW — code and IaC controls have advanced, but environment-specific proof and reviewer signoff are still required** | Security / DevOps Lead | Before external pilot access | **[`docs/security/g3-security-controls-platform.md`](./security/g3-security-controls-platform.md)** (rollup; not a GREEN claim) | Pending |
| **G4** | Auditability & forensics | Every customer-impacting event is reconstructable—including auth failures, CAD previews, integrations, entitlement changes—with owner metadata and retention/export plan tested for incident review drills. | YELLOW — schema exists; widen scenario coverage | *Assign compliance liaison* | *YYYY-MM-DD* | *Paste audit sample exports redacted links* | Pending |
| **G5** | Operational safety & rollback | Feature flags/runbooks/time-to-disable SLAs exercised; alerting + rollback drills evidenced; escalation owners pinned; integrations can be degraded without cascading UI failure. | YELLOW — runbooks templated but fire-drill proofs outstanding | *Assign SRE/ops commander* | *YYYY-MM-DD* | *Incident + rollback artifact links* | Pending |
| **G6** | CAD assisted / automated write-back (**hard stop**) | **Any** CAD write including assisted drafting, summaries, approvals, rollback tests against production-ish vendors—explicitly gated and **must remain unavailable** absent multi-party governance. Mirrors code gate `CAD_WRITEBACK_ENABLED` + vendor wiring reality. | **RED — intentional block** until agency/vendor/security/release approvals | Agency CAD authority + integrations + security + release captain | Only after multi-party approvals (no default ETA) | *Future write-back evidence package—not applicable today* | **Blocked until explicit governance package** |

### 5A. Repository automation & evidence templates (path to GREEN)

These artifacts **support** evidence collection; they **do not** replace environment proof or sign-off. Until the gate sheet is updated with real links and owners, **G1–G5 remain YELLOW** as in the table above.

| Artifact | Purpose |
|---|---|
| `npm run test:g1` | JWT / anonymous fail-closed matrix on selected protected handlers (`apps/api/src/__tests__/security/jwt-validation.test.ts`). |
| `npm run test:g2` | CAD read-only / disabled adapter safety (`apps/web/lib/rapid-cortex/cad/__tests__/*`). |
| `npm run validate:all-gates` | Runs `test:security`, G2 Vitest files, then optional `security:g3` (warns if `BASE_URL` unset). |
| `npm run aws:print-web-env` (args: stage, region) | **AWS CLI:** reads CloudFormation outputs for `rapid-cortex-<stage>` and Cognito `describe-user-pool-client` (no secrets printed). Emits `NEXT_PUBLIC_*`, `COGNITO_*`, `API_UPSTREAM_BASE`, `BASE_URL`, `APP_ALLOWED_ORIGINS` for `apps/web/.env.local`. Example: `npm run aws:print-web-env -- dev us-east-1`. |
| `./scripts/security-g3-validation.sh` | Repo secret scan + webhook signature tests + optional `security:g3`. |
| `./scripts/audit-scenario-tests.sh` | G4 placeholder — set `API_URL` / `BASE_URL` before live audit curls. |
| `./scripts/fire-drill-rollback.sh` | G5 rollback / kill-switch **checklist** (no cloud mutations). |
| [`docs/evidence/templates/README.md`](./evidence/templates/README.md) | Copy templates into `docs/evidence/` when filling customer packets. |

### 5C. Communications / SMS evidence (Twilio toll-free)

#### Toll-Free Messaging Verification

**Status:** APPROVED  
**Provider:** Twilio  
**Verified Number:** +1 855-629-3679 (E.164: `+18556293679`)  
**Business:** Apps On Demand LLC  
**Approved use:** SMS/MMS messaging through Twilio for **Rapid Cortex** dispatcher-initiated, incident-specific workflows to individuals who contacted 911/public safety and gave consent — see [`docs/product-architecture/INCIDENT_MEDIA_SMS.md`](./product-architecture/INCIDENT_MEDIA_SMS.md).  
**Evidence:** Twilio approval email from **donotreply@twilio.com** (Twilio Consumer Trust Team); attach PDF beside this gate sheet when submitting a customer packet.  
**Twilio Toll-Free Verification Request SID:** `HH0d6af73f3875d5b5b416f7579f8144a2` (lookup / disputes in Twilio Console).  
**Twilio Account SID:** must match **`accountSid`** in your **Secrets Manager** Twilio JSON and the owning Twilio project — **do not** paste `TWILIO_AUTH_TOKEN` or API secrets into Markdown or ticket bodies.  
**Restriction:** Do **not** use this number for marketing, promotional campaigns, broad demos, newsletters, or unrelated outbound messaging — that can jeopardize toll-free verification.

**Controlled test message (staging / own handset first):**

> Rapid Cortex: A dispatcher requested a secure link for your active incident. Sharing is optional. Upload here: `https://<public-app-host>/media/upload/<token>` Reply STOP to opt out, HELP for help.

(use a real issuance token path in place of `<token>`; never paste live tokens into shared documents.)

<details>
<summary>Expandable: supporting acceptance tests (prior checklist)</summary>

**G1 — Tenant isolation & authentication**

- [ ] `401` for missing JWT on protected routes; `403` for invalid entitlement.
- [ ] Cross-tenant attempt yields `403` with no leakage; pilot JWT claims exercised on ≥2 tenants.
- [ ] RC Lite vs Rapid Cortex separation enforced where applicable.
- [ ] In-repo: `npm run test:security` (includes JWT/anonymous matrix + cross-tenant + RBAC); `npm run test:g1` for the JWT matrix file alone.

**G2 — CAD read scope**

- [ ] Approved read adapters only; write endpoints refuse real vendor writes (controlled disabled responses).
- [ ] Negative paths (timeouts, bad payloads, outages) degrade safely; feature-flag kill switch exercised.
- [ ] In-repo: `npm run test:g2` (read-only/disabled adapter expectations); staging smoke still required for vendor-specific behavior.

**G3 — Security controls**

- [ ] `npm run security:g3` passes in the **target** environment; logs archived.
- [ ] AWS Secrets Manager references verified **without** exposing secret values; no secrets in client bundles or logs.
- [ ] WAF WebACL confirmed attached to the correct CloudFront / API Gateway resource (proof attached).
- [ ] CORS allowlist tested with **approved** and **rejected** origins (proof attached).
- [ ] JWT/session validation verified on protected routes.
- [ ] Tenant isolation tested, including **attempted cross-agency** access.
- [ ] Square webhook signature validation tested with **valid**, **invalid**, and **missing** signatures.
- [ ] External inbound integrations: signatures, tokens, timestamps, or replay protections verified where applicable.
- [ ] S3/IAM policies reviewed for least privilege (evidence attached).
- [ ] Encryption in transit and at rest verified (evidence attached).
- [ ] Evidence links attached; Security / DevOps owner signs off; Platform / Compliance owner signs off where tenant isolation and auditability are involved.

**G4 — Auditing**

- [ ] Scenario pack (≥5 narratives) reproducible via audit trail export with request IDs/timeboxes.

**G5 — Operations**

- [ ] Alarm validation, rollback drills, escalation matrix signed with timestamps.

</details>

#### Plain-English summary (duplicate for stakeholders)

| Gate ID | Plain-English takeaway |
|---|---|
| **G1** | *Do the right logged-in humans only ever see **their agency’s** data?* |
| **G2** | *Does CAD behave as **read-only / shadow**, never surprising dispatch with unintended writes?* |
| **G3** | *Are infra + app defenses demonstrably enforcing least privilege and secrecy?* |
| **G4** | *Could an investigator reconstruct key actions afterward?* |
| **G5** | *Could we throttle or unwind a deployment without melting the customer’s floor?* |
| **G6** | *Is **any CAD write path** unquestionably forbidden until deliberate multi-party approvals?* — **today: NO write-back approvals; remains RED.** |

### G3 — Security Controls, Platform (detail)

**Current Status:** **YELLOW** — code and IaC controls have advanced, but environment-specific proof and reviewer signoff are still required.

**Principle:** Code + IaC progress does **not** replace environment-specific proof. G3 cannot move to **GREEN** until the **target environment** has **PASS** evidence and **reviewer signoffs**.

**Why G3 remains YELLOW:** Repository and template work advance controls, but the customer gate stays **YELLOW** until the evidence and approvals in the GREEN list below are satisfied **in the deployment being assessed** — not inferred from main-branch state or local runs alone.

**GREEN requirements (all must be complete in the target environment):**

- `npm run security:g3` passes in the target environment.
- AWS Secrets Manager references are verified without exposing secret values.
- WAF WebACL is confirmed attached to the correct CloudFront/API Gateway resource.
- CORS allowlist is tested with approved and rejected origins.
- JWT/session validation is verified on protected routes.
- Tenant isolation is tested, including attempted cross-agency access.
- Square webhook signature validation is tested with valid, invalid, and missing signatures.
- External inbound integrations validate signatures, tokens, timestamps, or replay protections where applicable.
- S3/IAM policies are reviewed for least privilege.
- Encryption in transit and at rest is verified.
- Evidence links are attached.
- Security / DevOps owner signs off.
- Platform / Compliance owner signs off where tenant isolation and auditability are involved.

**Current decision:** Keep G3 at **YELLOW**.

**Warning — do not mark G3 GREEN** based only on code, IaC, **local tests**, or intended configuration.

**Owner:** Security / DevOps Lead

**Target Date:** Before external pilot access

**Evidence Link:** **[`docs/security/g3-security-controls-platform.md`](./security/g3-security-controls-platform.md)** (rollup; not a GREEN claim). Language product/engineering context (911 tiered fallback, RC Lite vs Rapid Cortex): **[`docs/languages/911-language-fallback-reliability.md`](./languages/911-language-fallback-reliability.md)** — separate from G3 security closure.

**Signoff:** Pending

**Explicit non-claims:** This document does **not** assert **CJIS certification** or formal CJIS accreditation, **SOC 2 compliance** or Type II attestation, or **full production readiness** / unlimited production suitability.

## 5B. Authentication & CSRF Validation Testing Procedures

Exact procedures for validating authentication error handling and CSRF protection after deployment. Tie evidence to **G1** (tenant isolation & authentication) and **G3** (security controls).

Hosted password sign-in **never** invokes Cognito from the browser—the client **`POST`**s **`/api/auth/signin`** only; Cognito SDK work runs server-side.

**Canonical code references (update this list when paths change):**

- CSRF validation: **[`apps/web/lib/csrf.ts`](../apps/web/lib/csrf.ts)** (`validateCsrfForRequest`, `ensureCsrfOnAuthApiRequest`).
- CSRF identifiers: **[`apps/web/lib/csrf-constants.ts`](../apps/web/lib/csrf-constants.ts)** (`rc_csrf_token`, `x-csrf-token`).
- Auth route error classification: **[`apps/web/lib/cognito-route-errors.ts`](../apps/web/lib/cognito-route-errors.ts)** (`mapUpstreamAuthFailure`).
- Cognito JWT → session user (includes **`custom:status`**): **[`apps/web/lib/auth/verify-cognito.ts`](../apps/web/lib/auth/verify-cognito.ts)**.
- CSP directives: **`buildCspHeader`** in **[`apps/web/next.config.ts`](../apps/web/next.config.ts)**.
- Repo scripts (**implementation source for shell steps**): **[`scripts/test-csrf-validation.sh`](../scripts/test-csrf-validation.sh)**, **[`scripts/test-auth-errors.sh`](../scripts/test-auth-errors.sh)**.

**Important:** Reference tables below quote **current production code**. This section is **not** the runtime source of truth—always confirm in the canonical files listed above **and update this subsection in the same change** whenever messages or CSP logic change.

**Common documentation mistakes (these do **not** match this repo today):**

- CSRF treats **either** absent **`rc_csrf_token`** **or** absent **`x-csrf-token`** header as **`"CSRF validation failed: missing CSRF token."`**—there is **no** separate **`Missing CSRF cookie`** JSON substring in **`csrf.ts`**.
- CSRF wording is **sentence case with a trailing period**, not Title Case (**`missing`**, **`invalid`**, **`origin is not allowed.`**, etc.).
- **`POST /api/auth/signin`** does **not** return **`Account is not active`**; **`custom:status` ≠ active** prevents [`mapJwtToUser`](../apps/web/lib/auth/verify-cognito.ts) from yielding a session user **after** token issuance (**see JWT row in auth table notes**).
- Production **`script-src`** in **`next.config.ts`** is **`'self' 'wasm-unsafe-eval'`** (no **`unsafe-inline`** on scripts; **`unsafe-eval`** only in **development** for Turbopack); production **`img-src`** is tightened to **`rapidcortex.us`** apex + **`www`** (development keeps broader **`https:`**). Duplicating CSP in Markdown TypeScript excerpts drifts—read **`buildCspHeader`**. **CloudFront / CDN / proxies** sometimes add a **second** CSP—browsers intersect policies, so **`curl`** on one hop can disagree with violations. **Production** sends **`Content-Security-Policy`** (enforcing) by default—set **`NEXT_PUBLIC_CSP_ENFORCE`** to **`false`** / **`0`** / **`report-only`** temporarily for **`Content-Security-Policy-Report-Only`** while collecting **`inline`** **`script`** reports (**`/api/csp-report`**).

### CSRF error messages reference

Every CSRF failure is **403 Forbidden** with body **`{"error":"<string>"}`** where **`<string>`** matches **`csrf.ts` exactly**:

| Failure condition | HTTP | Exact **`error`** string (embedded in JSON) |
|---|---|---|
| Allowlist empty / unset | 403 | `CSRF validation failed: origin allowlist is not configured.` |
| No derivable **`Origin`** / **`Referer`** origin | 403 | `CSRF validation failed: missing Origin header.` |
| Origin not allowlisted | 403 | `CSRF validation failed: origin is not allowed.` |
| Cookie **`rc_csrf_token`** missing **or** header **`x-csrf-token`** missing | 403 | **`CSRF validation failed: missing CSRF token.`** (**one** branch) |
| Cookie + header mismatch | 403 | **`CSRF validation failed: invalid CSRF token.`** |

### Authentication error responses reference (`POST /api/auth/signin`)

**Canonical mapper:** **`mapUpstreamAuthFailure`** ([`cognito-route-errors.ts`](../apps/web/lib/cognito-route-errors.ts)); route extras: **200**, **202** challenges.

| Scenario | HTTP | Response | **`code`** | Notes |
|---|---|---|---|---|
| Wrong password, **NotAuthorized**, **UserNotFound**, many other SDK throws | **401** | `{"error":"Invalid credentials"}` | Usually omitted | Same generic **`error`** deliberately |
| **InitiateAuth** challenge | **202** | `{ "challenge", "session", "username", … }` | — | MFA / forced password flows |
| Tokens issued | **200** | `{ "ok": true }` + `Set-Cookie` | — | **`rc_*`** cookies (**see below**) |
| Transient SDK / networking | **503** | `{"error":"Authentication service is temporarily unavailable.","code":"AUTH_UPSTREAM_UNAVAILABLE"}` | `AUTH_UPSTREAM_UNAVAILABLE` | **Not** the shorter “unavailable” string |
| Bad pool/client/region wiring | **503** | `{"error":"Authentication is misconfigured.","code":"AUTH_CONFIGURATION_ERROR"}` | `AUTH_CONFIGURATION_ERROR` | |
| **TooManyRequestsException** | **429** | `{"error":"Too many sign-in attempts. Try again in a few minutes.","code":"TooManyRequestsException"}` | `TooManyRequestsException` | **`retryAfter` not** in JSON today |
| **PasswordResetRequired** / **UserNotConfirmed** / **InvalidParameter** | **409** / **400** | `error` + `code` per mapper rows | **`name`** of exception | Inspect [`cognito-route-errors.ts`](../apps/web/lib/cognito-route-errors.ts) |

**JWT / inactive accounts:** Hosted sign-in **can** return **200/202** until Cognito issues tokens; **`custom:status`≠`active`** then surfaces as **null user** via **`verify-cognito.ts`** (**not** **`Account is not active`** on **`/signin`**).

### Required cookie: **`rc_csrf_token`**

1. Obtain **`GET /api/auth/session`** (**sets** **`rc_csrf_token`**; **not** **`httpOnly`**, **`sameSite: strict`** in prod).
2. For **`POST` / `PUT` / `PATCH` / `DELETE`** **`/api/auth/*`**, send **both**: browser cookie **`rc_csrf_token`** **and** header **`x-csrf-token`** with **identical raw values**.

**Success cookies** ([`apply-auth-cookies.ts`](../apps/web/lib/auth/apply-auth-cookies.ts)): **`rc_id_token`**, **`rc_access_token`**, **`rc_refresh_token`** — **`httpOnly: true`**, **`sameSite: 'lax'`**, **`secure`** in production (**not** names like **`auth_token`**).

Without step 1, **`curl`** sign-in yields **403** **`missing CSRF token.`**, not **401**.

### Test procedure: CSRF double-submit validation

Prefer the maintained script (**`awk -F'\t'`** Mozilla jar semantics; override host with **`BASE=`**):

```bash
chmod +x scripts/test-csrf-validation.sh
BASE=https://your-host.example ./scripts/test-csrf-validation.sh
```

Expect **403** **`missing`** / **`invalid`** / **`origin is not allowed.`** variants as exercised; Step “header-only, no **`Cookie`** jar” hits **`missing CSRF token.`**—**not** a distinct **`Missing CSRF cookie`** body.

Minimal manual sniff (inspect **`cookies.txt`** if **`awk`** columns differ):

```bash
BASE=https://rapidcortex.us
J=cookies.txt
curl -fsS "$BASE/api/auth/session" -c "$J" -o /dev/null
CSRF="$(awk -F'\t' '$6=="rc_csrf_token"{print $7; exit}' "$J")"
curl -fsS "$BASE/api/auth/signin" -b "$J" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" -H "x-csrf-token: $CSRF" \
  -d '{"email":"you@agency.invalid","password":"WrongPass999!"}'
# HTTP 401 + {"error":"Invalid credentials"}
```

### Test procedure: authentication error categorization

```bash
chmod +x scripts/test-auth-errors.sh
BASE=https://your-host.example ./scripts/test-auth-errors.sh
```

**503** probing remains **staging-only** (**misconfigured pool IDs** **or** network isolation)—manual; expect **`AUTH_CONFIGURATION_ERROR`** vs **`AUTH_UPSTREAM_UNAVAILABLE`** per **mapper**, not abbreviated prose.

### CSP configuration validation

**Critical:** Hosted password auth **never** needs **`connect-src https://cognito-idp …`**—the browser stays on same-origin **`/api/auth/*`** only.

**Only** authoritative Next policy: **`apps/web/next.config.ts`** (**`async headers()` → `buildCspHeader`**) — **`connect-src`** includes **`'self'`**, **`blob:`**, env-derived origins, production fallbacks (**`rapidcortex.us`** + API Gateway **`execute-api`** URL), enforcing **`Content-Security-Policy`** by default when **`NODE_ENV=production`** (override Report-Only with **`NEXT_PUBLIC_CSP_ENFORCE=false`**/**`report-only`**); **`script-src`**: prod **`'self' 'wasm-unsafe-eval'`**, dev **`'self' 'unsafe-eval'`**, **`style-src`** with **`unsafe-inline`**, **`report-uri /api/csp-report`**. **inspect the live response**: duplicate enforcing headers **`intersect`**—often why violations look “stricter than” a single **`curl -I`** line. CSP is **not** emitted from **`middleware`**—only **`next.config`** **`headers`**.

```bash
curl -sI "https://YOUR-HOST/login" | tr -d '\r' | grep -i '^content-security-policy'
```

### Safari **`script-src`** / nonces

Only after **full CSP enforcement** and **confirmed** violating inline scripts (Safari / Chrome / Firefox). **Do not** drop in generic **middleware + `experimental.nonce`** tutorials without an engineering/security decision (**issue / ADR**).

### Post-deployment validation checklist

**CSRF:**

- [ ] **`GET /api/auth/session`** issues **`rc_csrf_token`**.
- [ ] **403** **`"CSRF validation failed: missing CSRF token."`** when **`x-csrf-token`** omitted **while** jar present **— and** when header present **without** **`Cookie`** (same JSON both times).
- [ ] **403** **`invalid CSRF token.`** header/cookie mismatch.
- [ ] **403** **`missing Origin header.`** / **`origin is not allowed.`** / **`origin allowlist is not configured.`** exercised per deployment edge cases.

**Authentication API:**

- [ ] Wrong password ⇒ **401** **`Invalid credentials`** (usually **no** **`code`**).
- [ ] Throttle ⇒ **429** exact **`Too many sign-in attempts. Try again in a few minutes.`** + **`TooManyRequestsException`** (no **`retryAfter`** assertion).
- [ ] Misconfig / outages ⇒ **503** bodies above (**temporary unavailable** wording for upstream).

**CSP:**

- [ ] Header emitted (**`Content-Security-Policy`** enforcing in **`NODE_ENV=production`** by default; **`-Report-Only`** only when **`NEXT_PUBLIC_CSP_ENFORCE`** **`false`** / **`0`** / **`report-only`**, or in non-prod unless **`NEXT_PUBLIC_CSP_ENFORCE=true`**).
- [ ] **`connect-src`** excludes Cognito **`cognito-idp`** hosts for this auth model.
- [ ] Matches **`next.config.ts`** (prod **`wasm-unsafe-eval`** on **`script-src`**, **not** **`unsafe-inline`**; dev uses **`unsafe-eval`**; tighten further with hashes/nonce if needed).

**Cookies / session:**

- [ ] **`rc_id_token`** / **`rc_access_token`** / **`rc_refresh_token`** on success; **`rc_csrf_token`** remains readable for double-submit (**not httpOnly`).
- [ ] Persist / clear behavior matches existing sign-out/session routes (**capture Network evidence**).

**Evidence:** Archive script transcripts under **`docs/evidence/`** or customer packet; CSP / cookie screenshots attached to gate row.

— **Owner:** *Engineering Lead, Security Lead, DevOps Lead (assign)*  
— **Cadence:** After every auth/session/CSP deployment + **minimum quarterly**.

### Cross-reference

§5B supports **P0 G1/G3**: link generated artifacts beside **Evidence** columns in **`## 5`**. Rename/move canonical files ⇒ update bullets at top **and** prose here in one PR.

**Reminder:** Verification rows using Title Case (**`Missing CSRF token`** without trailing **`.`**), split cookie/header failure strings, shorthand **503 `"Authentication service unavailable"`**, **429 `"Please try again later"`**, production **`unsafe-eval`** as mandatory, or **`Account is not active`** on **`/signin`** are **incorrect for this codebase** unless implementation changes (**see mismatch list above**).

## 6. P1 Gates — Required for Full Go, Can Follow Read-Only Pilot

| Gate | Current Status | Required For | Owner | Target Date | Mitigation During Pilot | Evidence Link | Signoff |
|---|---|---|---|---|---|---|---|
| Desktop production hardening, signing, notarization, update posture | YELLOW | Full production rollout |  |  | Limit rollout scope to pilot users and monitored channels |  |  |
| Customer network posture, IP allowlist, VPN, on-prem connectivity runbook | YELLOW | Production integration reliability |  |  | Use documented temporary network controls and approved allowlists |  |  |
| Malware/DLP file controls for uploaded assets if contract requires | YELLOW | Contractual/security compliance |  |  | Restrict file types and enforce manual review |  |  |
| SLOs and error budgets for API and integration paths | YELLOW | Production reliability management |  |  | Use interim monitoring thresholds and weekly review cadence |  |  |
| Write-back governance, human approval, rollback, idempotency guarantees | RED | Any CAD write-back enablement |  |  | Keep write-back disabled by hard gate and feature flag |  |  |
| Production support model and escalation coverage | YELLOW | Customer production support |  |  | Pilot-only support windows with named escalation owners |  |  |
| Customer training completion | YELLOW | Safe operational use |  |  | Limit access to trained user cohorts |  |  |
| Data retention and export policy confirmation | YELLOW | Compliance and legal readiness |  |  | Apply interim documented retention policy and manual export process |  |  |
| Billing and entitlement verification | YELLOW | Commercial readiness |  |  | Manual entitlement review before pilot onboarding |  |  |
| RC Lite API usage metering and overage reporting | YELLOW | RC Lite production API access |  |  | Restrict RC Lite access to controlled pilot plans |  |  |

## 7. Decision Matrix

**GREEN / GO:**  
All P0 gates pass, no unresolved critical findings, and approved scope matches tested capabilities.

**YELLOW / CONDITIONAL GO:**  
P0 gates pass for read-only pilot scope. P1 gaps are tracked with named owners, dates, mitigations, and customer-facing limitations.

**RED / NO-GO:**  
Any P0 failure exists, especially:
- Tenant boundary risk
- Ungoverned CAD write capability
- Missing rollback or kill-switch
- Unresolved critical security blocker
- Missing audit trail for customer-impacting actions
- Failed webhook/API signature verification
- Missing customer approval for deployment scope

**Recommended Today:**
- Approve YELLOW read-only pilot with one customer and explicit scope limits.
- Do not approve GREEN/full production rollout.
- Do not approve CAD write-back.

## 8. Exact Exit Criteria to Move YELLOW to GREEN

- [ ] One real CAD vendor adapter validated in staging.
- [ ] One real CAD vendor adapter validated in pilot.
- [ ] All P0 tests pass **in the assessed environment** with signed evidence package (repo Vitest + `security:g3` with `BASE_URL` are supporting artifacts only — see §5A).
- [ ] Deployment blockers marked closed with proof.
- [ ] Incident drill completed successfully.
- [ ] Rollback drill completed successfully.
- [ ] Customer training completed.
- [ ] Customer signoff received.
- [ ] Support escalation process validated.
- [ ] Monitoring and alarms validated.
- [ ] Audit evidence package completed.
- [ ] RC Lite API-only access confirmed separate from Rapid Cortex dashboard access.
- [ ] CAD write-back remains off until separate write-readiness gate is passed.

## 9. CAD Write-Back Hard Gate

CAD write-back is a separate hard gate. Passing the read-only pilot gate does not approve CAD write-back.

Requirements before CAD write-back can be enabled:
- [ ] Written customer approval.
- [ ] Written CAD vendor approval if required.
- [ ] Vendor-specific write adapter implemented.
- [ ] Field mapping approved by customer.
- [ ] Human review workflow implemented.
- [ ] Dispatcher/supervisor approval workflow implemented.
- [ ] Rollback procedure documented and tested.
- [ ] Duplicate prevention implemented.
- [ ] Idempotency keys implemented.
- [ ] Retry policy implemented.
- [ ] Error handling implemented.
- [ ] Every write attempt audit logged.
- [ ] Feature flag enabled per agency only.
- [ ] Staging signoff completed.
- [ ] Production smoke test completed.
- [ ] Security review completed.
- [ ] Incident response plan completed.
- [ ] Legal/contract approval completed if required.

**Default Status:**  
RED / NO-GO until every item is complete and signed off.

## 10. Customer Meeting Script

"Rapid Cortex is ready for a controlled read-only pilot. We are intentionally keeping CAD write-back disabled during the first phase to protect the customer's live CAD environment. This allows the agency to validate AI summaries, transcription, translation, operational visibility, audit logs, and workflow fit without changing CAD records. Write-back will only be considered after all technical, operational, and approval gates are met."

## 11. Release Signoff

| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Executive Sponsor |  |  |  |  |
| Product Owner |  |  |  |  |
| Engineering Lead |  |  |  |  |
| Security Lead |  |  |  |  |
| DevOps / Infrastructure Lead |  |  |  |  |
| Customer Success Lead |  |  |  |  |
| Customer Representative |  |  |  |  |
| CAD Vendor Representative, if applicable |  |  |  |  |

## 12. Final Recommendation

Proceed with one-customer read-only pilot only when all P0 pilot gates pass.  
Do not enable CAD write-back.  
Implement and validate one real CAD read adapter.  
Capture evidence.  
Reassess after pilot exit criteria are met.

This document should be copied for every major customer deployment, release gate, or CAD integration milestone.

## 13. Milestone Status Update (2026-04-29)

**Aggregate readiness:** **YELLOW** — conditional go for scoped read-only/shadow pilot only (unchanged from §2). **Do not** treat this section as production GREEN.

**Repository / engineering milestones (supporting evidence work, not sign-off):**

- [x] In-process **G1** Vitest coverage expanded: anonymous / invalid Bearer matrix on representative handlers; existing cross-tenant + RBAC suites (`npm run test:g1`, `npm run test:security`).
- [x] In-process **G2** Vitest: read-only bridged adapter, write-back blocked, disabled-mode behavior (`npm run test:g2`).
- [x] **Gate runner:** `npm run validate:all-gates` (automated tests + optional `security:g3` when `BASE_URL` is set).
- [x] **Evidence templates** for G1–G5 (+ aggregate GREEN report template) under [`docs/evidence/templates/`](./evidence/templates/README.md).
- [ ] One **customer** CAD vendor read adapter validated end-to-end in **customer** staging (Motorola or other) with logs attached to G2 template.
- [ ] **G3** `npm run security:g3` **PASS** in target environment + WAF/CORS/secrets/console evidence attached.
- [ ] **G4** audit scenario pack reproduced with exports (request IDs / timeboxes).
- [ ] **G5** rollback / kill-switch **fire drill** executed with dated log attachments (use `./scripts/fire-drill-rollback.sh` as checklist starter).
- [ ] Customer training + **written** pilot sign-offs per §11.

**CAD write-back:** **RED** — still governed by §9; no change from intentional pilot posture.

## 14. Public Status Page Readiness

**Current status:** **YELLOW** — route/API implementation can exist before DNS and monitoring evidence are complete.

Public status page is operational-readiness evidence, not a security certification claim.

### GREEN requirements

- [ ] `https://status.rapidcortex.us` resolves publicly.
- [ ] Status page loads without login.
- [ ] `/api/status` returns public status data only.
- [ ] No sensitive data is exposed (no secrets, tokens, agency/customer/caller data, transcripts).
- [ ] Monitoring source for status/uptime is documented.
- [ ] Incident update process is documented.
- [ ] Owner signoff is completed.

### Evidence references

- Implementation + admin workflow: `docs/status-page/status-page-admin-plan.md`
- DNS/subdomain rollout notes: `docs/status-page/status-subdomain-setup.md`
