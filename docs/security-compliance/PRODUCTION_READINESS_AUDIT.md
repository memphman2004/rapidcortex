# Rapid Cortex — production readiness audit

**Audit date:** 2026-04-24  
**Scope:** Website, web app, API/Lambdas (as defined in `infra/template.yaml`), desktop scaffolds, documentation, infrastructure patterns, security posture.  
**Verdict (overall):** **PARTIAL** — suitable for **controlled pilot agencies** when **stack-specific** gates in [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) are completed; **not** a blanket “GA production ready” declaration.

This document is evidence-based. Items marked **FAIL** or **NOT FOUND** are missing or not verified in-repo; **PASS** means a reasonable implementation exists for pilot-grade use; **PARTIAL** means gaps, feature flags, or environment dependencies remain.

---

## Project-wide production gap summary

- **Overall verdict** remains **PARTIAL** unless and until stack-specific evidence (checklists, smoke logs, governance artifacts) proves a higher tier for **your** deployment.
- **Controlled pilot** may be possible once **stack-specific** gates in [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) and [ENVIRONMENT_READINESS_CHECKLIST.md](./ENVIRONMENT_READINESS_CHECKLIST.md) are closed with owners and dates.
- **Blanket GA / self-serve production** is **not** supported by current **repo-only** evidence: governance, WAF-as-code, full E2E automation, desktop GA hardening, and complete UX/state coverage remain gaps ([NEXT_DEPLOY_BLOCKERS.md](./NEXT_DEPLOY_BLOCKERS.md)).
- **CAD is only one integration track.** Non-CAD items also gate pilot and GA: environment parity, secrets/flags, CORS, multilingual configuration, telephony/radio ingest boundaries, audit logging, desktop distribution, edge protection, monitoring/paging, training/SOPs, and commercial/governance sign-offs ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md), [NON_GOALS.md](./NON_GOALS.md)).

### Code exists does not mean production is live

**Registry entries, API route files, or UI placeholders prove intent and structure.** They **do not** prove a feature is live, correctly configured, monitored, agency-approved, or production-ready. Treat [FEATURE_READINESS_MATRIX.md](./FEATURE_READINESS_MATRIX.md) and `apps/web/lib/rapid-cortex/features.ts` as a **capability map**, then verify each sold path with integration status, smoke tests, and operator sign-off ([DEPLOYMENT_READINESS_MAP.md](./DEPLOYMENT_READINESS_MAP.md)).

### Related readiness documents

- [DEPLOYMENT_READINESS_MAP.md](./DEPLOYMENT_READINESS_MAP.md) — definitions for **Dev-ready**, **Staging-ready**, **Controlled pilot-ready**, and **Production/GA-ready**.
- [NEXT_DEPLOY_BLOCKERS.md](./NEXT_DEPLOY_BLOCKERS.md) — deploy blockers by tier with priorities and default owners.
- [ENVIRONMENT_READINESS_CHECKLIST.md](./ENVIRONMENT_READINESS_CHECKLIST.md) — per-environment verification tables (works for **single-stack** programs by copying once per promotion).

---

## Executive summary

| Area | Status | Notes |
| --- | --- | --- |
| 1. Public website | **PARTIAL** | Core marketing, legal, pricing, desktop story, **CAD**, **security**, **contact** pages; **App Router** `sitemap` + `robots` added. Ongoing: content/SEO hardening. |
| 2. Sales / onboarding content | **PARTIAL** | Strong `docs/` corpus ([GTM_PACKAGE.md](./GTM_PACKAGE.md), training, pilot checklists). Tier copy uses **Essential / Professional / Command / Enterprise** in UI; sales shorthand **Core / Pro** mapped in [GTM_PACKAGE.md](./GTM_PACKAGE.md). |
| 3. Frontend app | **PARTIAL** | Role-scoped dispatch/admin/supervisor routes; middleware auth for protected paths; integration status & pilot hub. Full UX audit of every empty/loading state not completed in this pass. |
| 4. Desktop apps | **PARTIAL** | macOS Xcode + Windows WPF **Phase 1** scaffolds exist; OAuth token exchange **not** end-to-end; installers via **admin signed URLs** (not public). |
| 5. APIs / Lambdas | **PARTIAL** | Large `template.yaml` surface; JWT + role patterns in handlers; many features behind **env flags**; full end-to-end verification requires staging tests. |
| 6. Infrastructure | **PARTIAL** | SAM template, PITR parameterization, API throttling, **many** CloudWatch alarms; **AWS WAF** not defined in reviewed `template.yaml` snippet; CI/CD depends on your org’s pipelines (not fully specified in-repo). |
| 7. Security / compliance | **PARTIAL** | [SECURITY_MODEL.md](./SECURITY_MODEL.md), [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md); **not** a CJIS certification claim. |

**Files heavily used for evidence:** `infra/template.yaml`, `apps/web/middleware.ts`, `apps/web/lib/api.ts`, `apps/api/src/**`, `docs/PILOT_READINESS_CHECKLIST.md`, `docs/FEATURE_FLAGS.md`, `apps/desktop-macos/**`, `apps/desktop-windows/**`.

---

## What is production-ready *today* (pilot-scoped)

- **Multi-tenant API** with extensive routes (see [API_SURFACE.md](./API_SURFACE.md) and `infra/template.yaml`).
- **Cognito-shaped auth** in web (`middleware`, cookies, optional auth proxy) and **Bearer JWT** for API.
- **Agency / platform admin** surfaces, **audit** concepts, **billing** API stubs (Square integration as documented).
- **Documentation** for operators: deployment, runbooks, security model, pilot governance, CAD integration *posture* (adapters not assumed live).
- **Desktop Phase 1** projects buildable; **admin download flow** for macOS artifacts documented ([DESKTOP_DOWNLOAD_FLOW.md](./DESKTOP_DOWNLOAD_FLOW.md)).

---

## What is only partially ready

- **“Production” for every feature flag** — many paths require explicit env enablement and secrets ([FEATURE_FLAGS.md](./FEATURE_FLAGS.md), [ENVIRONMENT_CONFIGURATION_REFERENCE.md](./ENVIRONMENT_CONFIGURATION_REFERENCE.md)).
- **CAD bidirectional integration** — documented boundaries; live vendor connectors **not** guaranteed ([INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md), [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).
- **Native desktop** — login/token refresh not complete; suitable for dev smoke tests, not as sole production client without finishing OAuth.
- **SEO** — root `metadata` exists; per-page metadata on many routes; dynamic **`sitemap.ts` / `robots.ts`** in `apps/web/app/` (requires **`NEXT_PUBLIC_SITE_URL`** in production for canonical URLs).

---

## What is missing or not found (critical / high)

| ID | Item | Severity |
| --- | --- | --- |
| B1 | **Org-level pilot sign-off** (SOW, security review, data processing) | Critical (process) |
| B2 | **Staging/pilot environment** fully green on [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) | Critical |
| B3 | **WAF** / edge rate limits **as code** in this repo for API Gateway (API has throttling; WAF not in template grep) | High |
| B4 | **Verify sitemap in prod** (correct `NEXT_PUBLIC_SITE_URL`, submit to search consoles) | Medium |
| B5 | **Desktop OAuth token exchange** + refresh (macOS + Windows) | High for desktop GA |
| B6 | **End-to-end automated tests** covering all critical county workflows | High |

---

## High priority fixes completed *in this audit pass*

- Added **`docs/PRODUCTION_READINESS_AUDIT.md`** (this file).
- Added public marketing pages: **`/cad`**, **`/security`**, **`/contact`** (CAD positioning, security/CJIS-aligned posture, sales contact).
- Updated **`marketing-links.ts`**, **header/footer** navigation.
- Strengthened **homepage** copy: Rapid Cortex does **not** replace CAD; enhances with AI.
- Updated **[GTM_PACKAGE.md](./GTM_PACKAGE.md)** with sales vocabulary (Core/Pro vs Essential/Professional), capability bullets, and admin desktop download pointer.

---

## Remaining high priority fixes (for pilot hardening)

1. Set **`NEXT_PUBLIC_SITE_URL`** in production and verify `/sitemap.xml` + `/robots.txt`; submit sitemap in search consoles as needed.
2. Run **[PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md)** + `./scripts/post-deploy-smoke.sh` (or equivalent) on the **pilot** stack; record results.
3. **WAF** + ALB/API Gateway association in infra (or org-level) with documented rules.
4. Complete **desktop OAuth** token exchange and remove dev-only paste flows for production builds.
5. **Spot-audit** dispatch/supervisor/admin UIs for consistent loading/error/empty states (file-by-file).

## Medium priority

- Open Graph / Twitter card images per key marketing page.
- Structured data (JSON-LD) for organization — optional.
- **Windows** desktop presigned download parity when `.exe` is published (see [DESKTOP_CONNECTION_AUDIT.md](./DESKTOP_CONNECTION_AUDIT.md)).

## Nice-to-have

- OpenAPI / generated client shared by web and desktop.
- Playwright smoke for critical web journeys in CI.

---

## Test commands

```bash
cd "/path/to/Rapid Cortex"
npm run build -w rapid-cortex-shared
# API
npm run build -w rapid-cortex-api
npx vitest run --project api 2>/dev/null || npx vitest run apps/api
# Web
npm run build -w rapid-cortex-web
```

```bash
cd infra && sam validate
```

```bash
# macOS (local)
xcodebuild -project apps/desktop-macos/RapidCortexDesktop/RapidCortexDesktop.xcodeproj -scheme RapidCortexDesktop -destination 'platform=macOS' build
```

```bash
# Windows WPF (cross-compile check)
dotnet build apps/desktop-windows/RapidCortexDesktop.sln -c Release
```

---

## Build & deployment commands (reference)

See [DEPLOYMENT.md](./DEPLOYMENT.md), [AWS_SETUP.md](./AWS_SETUP.md), [RUNBOOK.md](./RUNBOOK.md). Typical pattern: configure env → `sam build` / `sam deploy` → set Next.js env for web → `npm run build` web → deploy to hosting (see [WEB_HOSTING_AWS.md](./WEB_HOSTING_AWS.md)).

---

## Checklist (summary table)

| Area | Requirement | Status | Evidence / path | Fix completed or required |
| --- | --- | --- | --- | --- |
| Website | Homepage live | **PASS** | `apps/web/app/(marketing)/page.tsx` | CAD messaging added |
| Website | Pricing / tiers | **PASS** | `apps/web/lib/marketing/pricing-content.ts` | Map Core/Pro in GTM |
| Website | Legal: privacy, terms | **PASS** | `apps/web/app/(marketing)/privacy`, `terms` | — |
| Website | Public CAD story page | **PASS** (this pass) | `apps/web/app/(marketing)/cad/page.tsx` | New |
| Website | Public security / CJIS-aligned page | **PASS** (this pass) | `apps/web/app/(marketing)/security/page.tsx` | New |
| Website | Contact / pilot request | **PARTIAL** | `apps/web/app/(marketing)/contact/page.tsx` + mailto in pricing | New contact page; demo flow via mailto |
| Website | Desktop product page | **PASS** | `apps/web/app/(marketing)/desktop/page.tsx` | — |
| Website | SEO: sitemap/robots | **PASS** | `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts` | Set `NEXT_PUBLIC_SITE_URL` in prod |
| Onboarding | GTM + pilot docs | **PASS** | `docs/GTM_PACKAGE.md` | Enriched this pass |
| Web app | Auth middleware | **PASS** | `apps/web/middleware.ts` | — |
| Web app | API client | **PASS** | `apps/web/lib/api.ts` | — |
| Web app | All dashboards polished | **PARTIAL** | `apps/web/app/[jurisdiction]/**` | Ongoing |
| Desktop | macOS project | **PASS** (Phase 1) | `apps/desktop-macos/` | OAuth incomplete |
| Desktop | Windows WPF | **PASS** (Phase 1) | `apps/desktop-windows/` | OAuth incomplete |
| API | API Gateway + Lambdas | **PASS** (surface) | `infra/template.yaml` | Flags/env |
| API | JWT + RBAC | **PARTIAL** | `apps/api/src/lib/auth.ts`, handlers | Per-route |
| Infra | PITR DDB | **PASS** (param) | `DynamoPointInTimeRecovery` in template | Set per stage |
| Infra | Alarms | **PARTIAL** | `*Alarm` in template | Not exhaustive |
| Infra | WAF | **NOT FOUND** in repo | — | Add at org/infra |
| Security | No secrets in source | **PASS** (policy) | `.env.example`, docs | Keep scanning CI |
| Security | CJIS “aligned” docs | **PASS** (disclaimer) | `docs/SECURITY_MODEL.md` | Not certification |

*Full row-level checklist with PASS/PARTIAL/FAIL/NOT FOUND is in the “Detailed checklist” section below.*

---

## Detailed checklist (PASS / PARTIAL / FAIL / NOT FOUND)

| Area | Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Public website | Mobile-responsive marketing layout | **PASS** | Tailwind `sm:` breakpoints in marketing | — |
| Public website | Core messaging: CAD not replaced | **PASS** | Homepage + `/cad` | — |
| Public website | `robots.txt` / sitemap | **PASS** | `app/sitemap.ts`, `app/robots.ts` | — |
| Sales content | Subscription tier names in product | **PARTIAL** | `PRICING_PLANS` uses Essential/Professional | Core/Pro = shorthand in GTM |
| Sales content | Capabilities: multilingual, TTS, video, QA… | **PASS** | `pricing-content`, `GTM` bullets | GTM updated |
| Frontend | Role-based routes | **PASS** | `middleware`, app router layout | — |
| Frontend | IT admin downloads | **PASS** | `admin/settings/downloads` | — |
| APIs | `GET /api/health` | **PASS** | `template.yaml` | — |
| APIs | Incidents CRUD | **PASS** | Handlers + template | — |
| APIs | Rate limiting (API GW) | **PARTIAL** | `ThrottlingRateLimit` in template | Not WAF |
| Desktop | Keychain / DPAPI | **PASS** | `KeychainTokenStore`, `ProtectedTokenStore` | — |
| Desktop | Notarized DMG / signed MSI docs | **PARTIAL** | `DESKTOP_DISTRIBUTION_OPTION_1.md` | Process docs |
| Infra | Dev/stage/prod parameters | **PASS** | `DeploymentStage` | `pilot` allowed |
| Compliance | PII in logs policy | **PASS** | `SECURITY_MODEL`, `PRIVACY_RETENTION` | Enforce in ops |

---

## Final summary (for leadership)

### Production ready *now* (with pilot scope and operator gates)

- Web application with authentication, large API surface, and **documented** operational model.
- Marketing and legal baseline pages, plus new **CAD**, **security**, and **contact** pages.
- Infrastructure-as-code with monitoring hooks and **pilot** documentation path.

### Not production ready *yet* (as universal GA / unmanaged self-serve)

- **Certification** claims (CJIS, SOC 2, etc.) — *not* asserted by this repo.
- **Full desktop** client parity with web (OAuth E2E, installers in production channels).
- **WAF** and complete **edge** hardening in-repo.
- **100%** UI state coverage and automated E2E.

### Top 10 blockers (pilot → hardened production)

1. **Pilot checklist** not executed and signed for **your** target stack.  
2. **Secrets and feature flags** not aligned for real traffic (AI, multilingual, media).  
3. **CORS and origins** must match real web URL(s) in deployment.  
4. **WAF** / abuse protection for public API (if exposed beyond agency VPN).  
5. **Desktop OAuth** completion for agencies that mandate native clients.  
6. **CAD integration** scope: confirm adapter mode vs API-only with customer.  
7. **Monitoring & paging**: alarm actions need SNS/Slack destination (template has alarm resources; wiring is org-specific).  
8. **Data retention** legal sign-off ([PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)).  
9. **SEO**: confirm canonical **`NEXT_PUBLIC_SITE_URL`** and search-console sitemap submission.  
10. **Load / chaos** testing on staging for peak transcript throughput.

### Exact next implementation prompt (copy-paste)

> **Next:** (1) Run `PILOT_READINESS_CHECKLIST.md` against the **staging** stack; fix any FAIL (CORS, secrets, `GET /api/integration/status`). (2) Add **AWS WAFv2** Web ACL association to API Gateway in `infra/template.yaml` (or separate stack) with AWS Managed Rule groups + per-route throttling; document in `RUNBOOK.md`. (3) Implement Cognito **authorization-code + PKCE** token exchange in `apps/desktop-macos` and `apps/desktop-windows`, persisting refresh tokens, and remove Debug-only token paste in Release builds. (4) Spot-audit `apps/web/app/[jurisdiction]/(dispatch)/**/page.tsx` for `loading.tsx` / error boundaries where missing. (5) Confirm production **`NEXT_PUBLIC_SITE_URL`** matches the live host for metadata, sitemap, and OAuth redirect configuration.

---

*This audit does not replace agency counsel, security assessments, or vendor DPAs.*
