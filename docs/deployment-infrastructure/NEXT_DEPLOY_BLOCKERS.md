# Next deploy blockers

**Question answered here:** *What blocks the next deploy?*

**How to use:** Pick the **target readiness tier** ([DEPLOYMENT_READINESS_MAP.md](./DEPLOYMENT_READINESS_MAP.md)). If your program uses **a single long-lived stack**, map your next promotion to **Controlled pilot** and **Production/GA** blockers for that same hostname — do not assume a separate staging account exists.

**Priorities:**

- **P0** — blocks deployment to that tier.
- **P1** — blocks pilot **confidence** (should fix before inviting agency floor time).
- **P2** — required before **scale** or GA.
- **P3** — improvement / hygiene.

**Status values:** `NOT STARTED` | `IN PROGRESS` | `MITIGATED` | `PASS` (only with evidence). Default in this seed: **NOT STARTED** for org-owned gates; **PARTIAL** where repo implements code but stack evidence is missing.

**Owner:** Default `NEEDS OWNER` until your program assigns names.

---

## Dev deploy blockers

| ID | Area | Blocker | Why it matters | Required fix | Evidence needed | Owner | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEV-001 | Quality | Local web/API build fails | Engineers cannot iterate | Fix compile/lint errors | CI or local build log green | NEEDS OWNER | NOT STARTED | P0 |
| DEV-002 | Configuration | Missing `.env` / secrets for local API | Features falsely appear “broken” | Document and template local env ([ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)) | Local boot + health check | NEEDS OWNER | NOT STARTED | P1 |
| DEV-003 | Demo hygiene | Offline/demo mode confused with “real” product | Wrong expectations | Label demo paths ([NON_GOALS.md](./NON_GOALS.md) §5) | Screenshot or copy audit | NEEDS OWNER | NOT STARTED | P2 |
| DEV-004 | Scripts | Smoke scripts not run locally before push | Regressions reach shared branches | Run `post-deploy-smoke` against dev API when available | Script output archived | NEEDS OWNER | NOT STARTED | P3 |

---

## Staging deploy blockers

*If **no staging stack** exists, mark these **NOT APPLICABLE** and run the same rows against your **pilot** stack with explicit risk acceptance.*

| ID | Area | Blocker | Why it matters | Required fix | Evidence needed | Owner | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| STG-001 | Environment | Staging stack not proven green | Unknown delta to pilot | Deploy + smoke + integration status | PILOT_READINESS_RUN_RESULTS | NEEDS OWNER | NOT STARTED | P0 |
| STG-002 | Smoke | `post-deploy-smoke.sh` not consistently passing | Regressions undetected | Fix failing routes; automate in CI | Green smoke log | NEEDS OWNER | NOT STARTED | P0 |
| STG-003 | Secrets | Secrets / feature flags not verified for realistic traffic | 501s or wrong provider in demos | Align flags with staging intent ([FEATURE_FLAGS.md](./FEATURE_FLAGS.md)) | Redacted config matrix + integration status | NEEDS OWNER | NOT STARTED | P1 |
| STG-004 | CORS | CORS not verified against real web origins | Browser auth/API failures | Update `HttpApiCorsAllowedOrigins`; document | Browser network proof | NEEDS OWNER | NOT STARTED | P0 |
| STG-005 | Web/API wiring | `NEXT_PUBLIC_AUTH_PROXY` / `API_UPSTREAM_BASE` / prod-like Next config not verified | Pilot-shaped web not actually API-connected | Configure per [INSTALLATION.md](./INSTALLATION.md) | Integration page + network traces | NEEDS OWNER | NOT STARTED | P0 |
| STG-006 | Demo boundaries | Demo/offline behavior not clearly enforced | Risk of staging data treated as production | Env discipline ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)) | Env screenshot / export (redacted) | NEEDS OWNER | NOT STARTED | P1 |
| STG-007 | AI providers | Sandbox keys not labeled / not rotated | Compliance and cost risk | Document sandbox ownership | Runbook note | NEEDS OWNER | NOT STARTED | P2 |
| STG-008 | Multilingual | Strict validation not run (`GET /api/integration/status`) | Voice routes 503 in demo | Fix secrets per [DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md) | Zero issues in UI/API | NEEDS OWNER | NOT STARTED | P1 |
| STG-009 | Edge | WAF not in repo template; staging may be exposed | Abuse / scanning risk | Apply [PILOT_AWS_DEFENSE.md](./PILOT_AWS_DEFENSE.md) or written exception | WAF assoc or risk memo | NEEDS OWNER | NOT STARTED | P2 |

---

## Controlled pilot deploy blockers

| ID | Area | Blocker | Why it matters | Required fix | Evidence needed | Owner | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PLT-001 | Governance | SOW / pilot agreement not confirmed | No authority to run live agency work | Execute agreement ([PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)) | Signed SOW or counsel email | NEEDS OWNER | NOT STARTED | P0 |
| PLT-002 | Governance | Security review not formally signed off | Unknown control gaps | Complete review; track findings | Review record | NEEDS OWNER | NOT STARTED | P0 |
| PLT-003 | Governance | DPA / data processing terms not signed | Legal exposure | Legal execution | Signed DPA | NEEDS OWNER | NOT STARTED | P0 |
| PLT-004 | Privacy | Privacy and retention sign-off incomplete | Retention disputes | [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md) acknowledged | Written agency acceptance | NEEDS OWNER | NOT STARTED | P0 |
| PLT-005 | IAM | Agency roles / `custom:agencyId` not verified | Wrong tenant isolation | Cognito audit ([COGNITO_SELF_SIGNUP.md](./COGNITO_SELF_SIGNUP.md)) | User export redacted | NEEDS OWNER | NOT STARTED | P0 |
| PLT-006 | Risk | Risk register incomplete | Unknown pilot hazards | [phase-0/risk-register.md](./phase-0/risk-register.md) | Updated register | NEEDS OWNER | NOT STARTED | P1 |
| PLT-007 | Training | Training and agency playbook incomplete | Unsafe floor use | Complete training checklists | Completed checklists | NEEDS OWNER | NOT STARTED | P1 |
| PLT-008 | Feature truth | Registry lists features that still resolve to placeholders | Oversold pilot | Align registry + routes + comms ([FEATURE_READINESS_MATRIX.md](./FEATURE_READINESS_MATRIX.md)) | Readiness + manual route proof | NEEDS OWNER | NOT STARTED | P1 |
| PLT-009 | API stubs | `app/api/**` still returns generic contract/config responses for sold modules | Pilot sees empty shells | Implement or descope from “sold” | Handler responses captured | NEEDS OWNER | NOT STARTED | P1 |
| PLT-010 | Readiness UI | Feature readiness dashboard reflects intent vs real route behavior | False confidence | Cross-check API + env | Audit worksheet | NEEDS OWNER | NOT STARTED | P2 |
| PLT-011 | AI / media | Providers not validated under peak-ish load | Incidents under stress | Pilot load smoke ([scripts/pilot-load-smoke.sh](../scripts/pilot-load-smoke.sh)) | Results log | NEEDS OWNER | NOT STARTED | P2 |
| PLT-012 | Multilingual | Multilingual routes may 503 if env incomplete | Floor outage on voice | Integration status clean | API + UI | NEEDS OWNER | NOT STARTED | P1 |
| PLT-013 | Transcripts | Transcript simulator vs live audio boundaries unclear | Wrong mental model | Train per [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) | Training sign-off | NEEDS OWNER | NOT STARTED | P1 |
| PLT-014 | Web UX | Loading / empty / error states incomplete | Operator confusion | Spot-audit pages ([PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md)) | Issue list closed or accepted | NEEDS OWNER | NOT STARTED | P2 |
| PLT-015 | Web UX | Full UX audit not completed | Unknown gaps | Schedule audit | Audit report | NEEDS OWNER | NOT STARTED | P3 |
| PLT-016 | A11y / perf | Accessibility / performance on target devices not completed | Exclusion or slowness | Test on target hardware | Test report | NEEDS OWNER | NOT STARTED | P3 |
| PLT-017 | Desktop | OAuth / token refresh / release hardening incomplete for in-scope desktop | Cannot support native pilot | Complete desktop Phase 2+ items ([DESKTOP_APP_API_CONTRACT.md](./DESKTOP_APP_API_CONTRACT.md)) | Release build + E2E | NEEDS OWNER | NOT STARTED | P1 if desktop in scope |
| PLT-018 | Desktop | Dev-only token paste or debug flows still in pilot path | Security risk | Remove/gate for Release | Build settings proof | NEEDS OWNER | NOT STARTED | P1 |
| PLT-019 | Desktop | macOS signing / notarization incomplete | Gatekeeper blocks install | Follow distribution docs | Notarization log | NEEDS OWNER | NOT STARTED | P2 |
| PLT-020 | Desktop | Windows installer signing incomplete | SmartScreen friction | Sign + doc | Cert proof | NEEDS OWNER | NOT STARTED | P2 |
| PLT-021 | Desktop | Update channel not production-ready | Stale clients | Defer desktop or ship update policy | Written policy | NEEDS OWNER | NOT STARTED | P3 |
| PLT-022 | API | Large API surface only partially E2E verified | Hidden regressions | Staging verification matrix | Test log | NEEDS OWNER | NOT STARTED | P1 |
| PLT-023 | API | Critical county workflow automation incomplete | Human cost / errors | Prioritize E2E ([PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md) B6) | Automated test names + pass | NEEDS OWNER | NOT STARTED | P2 |
| PLT-024 | API | JWT/RBAC behavior not end-to-end verified on target stack | Privilege bugs | Negative tests | Test evidence | NEEDS OWNER | NOT STARTED | P1 |
| PLT-025 | Infra | Monitoring alarms exist but paging not wired | Silent failures | SNS/Slack/PagerDuty per org | On-call roster | NEEDS OWNER | NOT STARTED | P1 |
| PLT-026 | Infra | Runbooks not exercised | Slow incident response | Tabletop + rollback drill | Dated drill notes | NEEDS OWNER | NOT STARTED | P1 |
| PLT-027 | SEO | `NEXT_PUBLIC_SITE_URL` not verified for this host | Wrong canonicals/sitemap | Set env; verify | Fetch sitemap/robots | NEEDS OWNER | NOT STARTED | P2 |
| PLT-028 | CAD | CAD vendor scope not approved (read-only vs write-back) | Vendor/legal breach | Agency + vendor sign ([CAD_CONNECTION_PLAYBOOK.md](./CAD_CONNECTION_PLAYBOOK.md)) | Written scope | NEEDS OWNER | NOT STARTED | P1 if CAD enabled |
| PLT-029 | CAD | Sandbox credentials / adapter missing | CAD features non-functional | Provision per playbook | Adapter health | NEEDS OWNER | NOT STARTED | P1 if CAD enabled |
| PLT-030 | Integrations | Telephony/CPE/radio ingest assumed in pilot | Undeliverable baseline | Align with [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) | Pilot scope addendum | NEEDS OWNER | NOT STARTED | P1 |

---

## Production / GA deploy blockers

Conservative defaults: most rows **NOT STARTED** or **PARTIAL** until **stack-specific PASS** evidence exists.

| ID | Area | Blocker | Why it matters | Required fix | Evidence needed | Owner | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GA-001 | Governance | All PLT governance blockers not closed | No GA authority | Close PLT-001–004 | Same as pilot + exec sign-off | NEEDS OWNER | NOT STARTED | P0 |
| GA-002 | Providers | Real (non-sandbox) providers not configured for **sold** modules | Contract breach / outage | Production keys + IAM | Provider console + change tickets | NEEDS OWNER | NOT STARTED | P0 |
| GA-003 | Security | `ALLOW_UNAUTHENTICATED_API` not hardened for GA | Data exposure | `false` in prod-like posture ([PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) §6) | Env proof | NEEDS OWNER | NOT STARTED | P0 |
| GA-004 | Edge | WAF / edge abuse protection not implemented as code or accepted exception | Security gap ([PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md)) | WAF in `template.yaml` or linked stack | Terraform/SAM link + ruleset | NEEDS OWNER | NOT STARTED | P0 |
| GA-005 | Data | Backup / restore not tested | RPO/RTO failure | Test restore | Drill log | NEEDS OWNER | NOT STARTED | P0 |
| GA-006 | Product | Critical sold routes still generic 501/config-only | False advertising | Implement or re-tier sales | Route matrix signed by PM | NEEDS OWNER | NOT STARTED | P0 |
| GA-007 | Readiness | Feature readiness not backed by monitoring + tests | Unknown production behavior | Tie alarms to features | Dashboard + on-call | NEEDS OWNER | NOT STARTED | P1 |
| GA-008 | Training | Training incomplete for all roles in SKU | Unsafe operations | Complete programs | LMS / sign-in sheets | NEEDS OWNER | NOT STARTED | P0 |
| GA-009 | Desktop | Desktop in GA scope without signed installers + update policy | Support nightmare | Distribution hardening | Notarization + MSI evidence | NEEDS OWNER | NOT STARTED | P0 if desktop in GA |
| GA-010 | SEO | Sitemap / search console not verified | SEO regressions | Submit + verify | Search console export | NEEDS OWNER | NOT STARTED | P2 |
| GA-011 | Pricing | Public pricing exposes internal dollar amounts | Commercial / trust failure | Keep quote-only ([pricing-content.ts](../apps/web/lib/marketing/pricing-content.ts)) | Public URL audit | NEEDS OWNER | NOT STARTED | P0 |
| GA-012 | Marketing | “CJIS certified” or “replaces CAD” language on public pages | Legal / trust failure | Remove; use aligned / enhance CAD only | `validate-docs-deployment-readiness.sh` + copy review | NEEDS OWNER | NOT STARTED | P0 |
| GA-013 | CAD | CAD treated as turnkey in GA messaging | Oversell | Vendor-specific program per [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md) | Per-vendor statement of work | NEEDS OWNER | NOT STARTED | P1 |

---

## Summary counts (seed)

| Section | Row count |
| --- | ---: |
| Dev | 4 |
| Staging | 9 |
| Controlled pilot | 30 |
| Production/GA | 13 |
| **Total** | **56** |

**P0 in seed:** DEV-001; STG-001, STG-002, STG-004, STG-005; PLT-001–005; GA-001–006, GA-008–009, GA-011–012.

**Owners:** All rows default **NEEDS OWNER** until assigned.

---

## Engineering hygiene backlog (non-blocking)

Tracked follow-ups from scripts/route consolidation (2026-06). Not deploy blockers; schedule before the next onboarding or sprint boundary.

| ID | Area | Item | Deadline / trigger | Required fix | Priority |
| --- | --- | --- | --- | --- | --- |
| HYG-001 | Web / dispatch | Dispatcher nav **Caller information** still uses `/caller` (redirects to `/calls` today) | **Before 2026-09-02** — `/caller` redirect stub removal date | Ship caller-info page; update `href` in [`role-dashboard-config.ts`](../../apps/web/lib/dashboards/role-dashboard-config.ts) to canonical route | P2 |
| HYG-002 | Docs | Smoke script docs still cite `post-deploy-smoke.sh` for **API** checks | Before onboarding new deploy operators | Point to `npm run smoke:api` or [`scripts/archive/post-deploy-api-smoke.sh`](../../scripts/archive/post-deploy-api-smoke.sh); web smoke → `npm run smoke:web` / `post-deploy-smoke.sh` | P3 |
| HYG-003 | Scripts | Validation script consolidation | Next scripts hygiene PR | Make `run-comprehensive-validation.sh` the single entry point; call or inline `validate-aws-environment.sh`, `validate-iam-policies.sh`, `validate-docs-deployment-readiness.sh`, `validation-checklist.sh` | P3 |
| HYG-004 | Scripts / deploy | SAM build cache investigation — ~3.5h deploy cycle despite `SAM_BUILD_USE_CACHE=1` | Same PR as HYG-003 (scripts-layer hygiene) | Confirm whether `npm run build -w rapid-cortex-api` runs before SAM build; if yes, enable/verify `tsc --incremental` in `apps/api/tsconfig.json`. Target: &lt; 30min incremental deploys | P2 |
| HYG-005 | API / rc-admin | **Platform notice dispatch API** — UI panel exists, no backend to post to | **Before pilot launch** | Wire [`platform-notice-target-panel.tsx`](../../apps/web/components/dashboards/platform-notice-target-panel.tsx) to a tenant-scoped POST endpoint (Zod + RBAC + audit); panel copy says "dispatch wiring is environment-dependent" | P1 |
| HYG-006 | Web / marketing | **Marketing static export pipeline** — `apps/marketing` (Option A) builds + syncs | **Build green** — remove duplicate `apps/web/app/(marketing)` + SSR path redirects | `npm run build:marketing` → `apps/marketing/out/`; `npm run sync:marketing`; shared `@/*` → `apps/web` until `packages/ui` extraction | P1 |
| HYG-007 | Web / deploy | **App-vs-www host routing guards** — prevent SSR image from serving marketing on `app.*` | Done (2026-06) — keep until HYG-006 removes marketing from SSR build | [`scripts/verify-host-routing.sh`](../../scripts/verify-host-routing.sh): CodeBuild post-build (`buildspec.web.yml`), prod deploy gate + ECS rollback (`deploy-web-no-docker.sh`), optional `SMOKE_VERIFY_HOST_ROUTING=1` / `PILOT_APP_ORIGIN` | P1 |

---

## Related documents

- [DEPLOYMENT_READINESS_MAP.md](./DEPLOYMENT_READINESS_MAP.md)
- [ENVIRONMENT_READINESS_CHECKLIST.md](./ENVIRONMENT_READINESS_CHECKLIST.md)
- [PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md)
