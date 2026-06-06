# Deployment readiness map

**Purpose:** Define **four readiness levels** for Rapid Cortex using **repo evidence** (code + `docs/`), not marketing claims. This map is the contract for what “ready” means at each tier.

**Primary sources:** [PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md), [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md), [FEATURE_READINESS_MATRIX.md](./FEATURE_READINESS_MATRIX.md), [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md), [NON_GOALS.md](./NON_GOALS.md), [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md), [CAD_CONNECTION_PLAYBOOK.md](./CAD_CONNECTION_PLAYBOOK.md), [PILOT_AWS_DEFENSE.md](./PILOT_AWS_DEFENSE.md), `apps/web/lib/rapid-cortex/features.ts`.

**Product facts (non-negotiable in documentation):**

- Rapid Cortex **enhances** existing CAD workflows; it **does not replace CAD** as the system of record.
- **CJIS-aligned controls** may be described in engineering/security docs; **CJIS certification** must not be claimed without a completed assessment program ([NON_GOALS.md](./NON_GOALS.md) §1).
- **Registry entries** (`features.ts`) describe intent, plans, env vars, and routes — they **do not** prove a capability is live, configured, monitored, or agency-approved ([FEATURE_READINESS_MATRIX.md](./FEATURE_READINESS_MATRIX.md)).
- **Public pricing** stays **quote-based**; internal dollar pricing must not appear on public marketing surfaces (`apps/web/lib/marketing/pricing-content.ts`).

---

## Single deployed environment (common case)

Some programs run **one** AWS + web hostname for an extended period. Readiness levels still apply as **gates on that stack**: you advance **configuration, governance, monitoring, and evidence** — not necessarily the number of URLs. When no discrete staging stack exists, use [ENVIRONMENT_READINESS_CHECKLIST.md](./ENVIRONMENT_READINESS_CHECKLIST.md) for the same physical env and mark staging-only rows **NOT APPLICABLE** with a note pointing to pilot-level verification on that stack.

---

## 1. Dev-ready

### Definition

Engineers can run the web app and/or API locally (or against a personal dev stack) with acceptable demo friction.

### What is allowed

- Mock incidents, offline demo mode, and configuration-missing responses where documented ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md), [NON_GOALS.md](./NON_GOALS.md) §5).
- Fast iteration without full governance artifacts.

### What is not allowed (as “agency floor ready”)

- Claiming pilot or GA readiness for this tier alone.

### Required evidence

- Local `npm run build` / `sam validate` patterns per [PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md) “Test commands”.

### Required owners

- Engineering lead for dev ergonomics.

### Required test results

- Developer smoke: builds and critical unit/API tests as run in CI or locally.

### Acceptable limitations

- `501` / “configuration required” API responses; stub Next `app/api/**` routes for unsold modules ([FEATURE_READINESS_MATRIX.md](./FEATURE_READINESS_MATRIX.md)).

### Unacceptable limitations

- None for dev — limitations must be **labeled** so they are not mistaken for production behavior.

---

## 2. Staging-ready

### Definition

A **non-production** stack (or a dedicated staging slice) that **mirrors pilot/prod configuration shape**: real Cognito, real web origin, CORS allowlist, representative secrets and feature flags — provider contracts may still be **sandbox** if explicitly documented.

### What is allowed

- Sandbox AI / speech / translation keys if labeled and isolated from agency production data policies.
- Deliberate feature flags off for unfinished modules.

### What is not allowed

- Wildcard CORS in a posture described as production-like ([PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) §2).
- Silent demo data mixed with customer acceptance tests without disclosure.

### Required evidence

- `./scripts/post-deploy-smoke.sh` (or `npm run smoke:api`) green after deploy ([PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) §3).
- `GET /api/integration/status` clean for modules in scope ([PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) §5).

### Required owners

- Platform/deploy owner; security reviewer for CORS and auth.

### Required test results

- Documented smoke run log ([PILOT_READINESS_RUN_RESULTS.md](./PILOT_READINESS_RUN_RESULTS.md)).

### Acceptable limitations

- No WAF yet **only** if risk is accepted in writing for that stage ([PILOT_AWS_DEFENSE.md](./PILOT_AWS_DEFENSE.md), [PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md)).

### Unacceptable limitations

- `ALLOW_UNAUTHENTICATED_API=true` treated as normal for staging that pretends to be prod-shaped.

---

## 3. Controlled pilot-ready

### Definition

**Limited agency users** on an agreed slice of production or pilot infrastructure with **signed or in-flight** governance (SOW/DPA/security) per agency policy, **acknowledged known limitations**, and **human-in-the-loop** operations for AI and CAD-adjacent workflows.

### What is allowed

- CAD **disabled**, **read-only**, or vendor-specific adapter per [CAD_CONNECTION_PLAYBOOK.md](./CAD_CONNECTION_PLAYBOOK.md) and [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md).
- AI as **decision support** only; manual dispatcher/supervisor review ([PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md), [MVP_SCOPE.md](./MVP_SCOPE.md)).

### What is not allowed

- Marketing or runbooks implying **GA / self-serve** scale without evidence.
- **CJIS certification** claims ([NON_GOALS.md](./NON_GOALS.md)).
- Positioning Rapid Cortex as **replacing CAD**.

### Required evidence

- Completed or in-progress items in [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) including monitoring and rollback pointers.
- Recorded limitations acknowledgment ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).

### Required owners

- Agency executive sponsor; named security/privacy owner; on-call or support path.

### Required test results

- Staging-equivalent smoke on the pilot stack; integration status for enabled modules.

### Acceptable limitations

- Telephony/CPE/radio ingest **not** guaranteed in baseline pilot ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).

### Unacceptable limitations

- No support contact, no rollback discussion, or undisclosed stub routes for **sold** pilot scope.

---

## 4. Production / GA-ready

### Definition

**General availability** posture: real providers for **sold** capabilities, agency workflow sign-off, security/privacy/retention completed, **monitoring and paging** active, **backup/restore** tested, **runbooks exercised**, and **no critical sold feature** left as generic `501` / config-only without disclosure.

### What is allowed

- Public marketing and SEO with verified canonical URLs ([PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md)).

### What is not allowed

- **Quote-based public pricing** violated (internal dollar amounts on public pages).
- Desktop in customer scope without signed/notarized or org-approved distribution story ([DESKTOP_CONNECTION_AUDIT.md](./DESKTOP_CONNECTION_AUDIT.md), [DESKTOP_DOWNLOAD_FLOW.md](./DESKTOP_DOWNLOAD_FLOW.md)).

### Required evidence

- WAF/edge posture documented in infra-as-code **or** written exception with compensating controls ([PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md), [PILOT_AWS_DEFENSE.md](./PILOT_AWS_DEFENSE.md)).
- E2E verification for **critical county workflows** (audit gap **B6**).
- Training and SOPs complete for roles in use.

### Required owners

- Product, security, SRE/platform, and agency signatories as applicable.

### Required test results

- Load/chaos or peak-ish validation where transcript throughput matters (audit “Top 10”).
- Backup/restore drill evidence.

### Acceptable limitations

- Nice-to-haves from audit (OG images, OpenAPI client) deferred with roadmap.

### Unacceptable limitations

- Critical routes for **sold** SKUs still generic stubs; missing paging; unverified `NEXT_PUBLIC_SITE_URL` in prod.

---

## Readiness matrix by area

Statuses per column: **PASS** | **PARTIAL** | **FAIL** | **NOT STARTED** | **NOT APPLICABLE** | **NEEDS OWNER**. **PASS** is used only where **clear in-repo evidence** exists; otherwise prefer **PARTIAL** / **NEEDS OWNER**.

**Current Status** = overall program posture evidenced by this repo (not your org’s private deploy). Default: **PARTIAL** at best for pilot-shaped work; **NOT STARTED** / **NEEDS OWNER** for org-specific gates.

| Area | Dev | Staging | Controlled Pilot | Production/GA | Evidence source | Current Status | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Governance and contracts | PARTIAL | PARTIAL | PARTIAL | NOT STARTED | PILOT_READINESS, PRODUCTION_READINESS_AUDIT | NEEDS OWNER | NEEDS OWNER | Checklist items exist; completion is org-specific. |
| Security and privacy | PARTIAL | PARTIAL | PARTIAL | PARTIAL | SECURITY_MODEL, PRIVACY_RETENTION, NON_GOALS | PARTIAL | NEEDS OWNER | Docs strong; formal sign-off external. |
| CJIS-aligned controls | PARTIAL | PARTIAL | PARTIAL | PARTIAL | SECURITY_MODEL, NON_GOALS | PARTIAL | NEEDS OWNER | **Aligned** language only; not certification. |
| Environments and deployment | PASS | PARTIAL | PARTIAL | PARTIAL | DEPLOYMENT, AWS_SETUP, template.yaml | PARTIAL | NEEDS OWNER | SAM + scripts in repo; org may run **one** env. |
| Secrets and feature flags | PARTIAL | PARTIAL | PARTIAL | PARTIAL | FEATURE_FLAGS, ENV refs, features.ts envVars | PARTIAL | NEEDS OWNER | Many flags; must match sold scope. |
| CORS and API origin configuration | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PILOT_READINESS §2, PILOT_AWS_DEFENSE | PARTIAL | NEEDS OWNER | Must match real web origins in prod-like stages. |
| Web/API wiring | PASS | PARTIAL | PARTIAL | PARTIAL | middleware, api.ts, INSTALLATION | PARTIAL | NEEDS OWNER | Patterns exist; prod wiring verified per stack. |
| Feature registry and entitlements | PASS | PARTIAL | PARTIAL | PARTIAL | features.ts, FEATURE_READINESS_MATRIX, readiness.ts | PARTIAL | NEEDS OWNER | Registry is **intent**; not proof of live routes. |
| AI provider integration | PARTIAL | PARTIAL | PARTIAL | PARTIAL | FEATURE_READINESS_MATRIX, INSTALLATION AI flags | PARTIAL | NEEDS OWNER | Mock-only prod policy explicit in docs. |
| Transcription provider integration | PARTIAL | PARTIAL | PARTIAL | PARTIAL | MULTILINGUAL_CALL_PIPELINE, handlers | PARTIAL | NEEDS OWNER | Simulator vs live audio in KNOWN_LIMITATIONS. |
| Translation provider integration | PARTIAL | PARTIAL | PARTIAL | PARTIAL | DEPLOYMENT_MULTILINGUAL_AWS, integration status | PARTIAL | NEEDS OWNER | Misconfig → 503 documented. |
| Text-to-voice integration | PARTIAL | PARTIAL | PARTIAL | PARTIAL | features.ts, API surface | PARTIAL | NEEDS OWNER | Plan/env gating. |
| Media storage and retention | PARTIAL | PARTIAL | PARTIAL | PARTIAL | template.yaml, PRIVACY_RETENTION | PARTIAL | NEEDS OWNER | Retention agency-led. |
| QA module | PARTIAL | PARTIAL | PARTIAL | PARTIAL | apps routes + FEATURE_READINESS | PARTIAL | NEEDS OWNER | UX audit incomplete per audit. |
| Incident module | PASS | PARTIAL | PARTIAL | PARTIAL | listIncidents handlers, template.yaml | PARTIAL | NEEDS OWNER | Core API exists; E2E coverage gap audit B6. |
| CAD integration | PARTIAL | PARTIAL | PARTIAL | PARTIAL | CAD_PLAYBOOK, INTEGRATIONS_CAD | PARTIAL | NEEDS OWNER | Vendor project; not turnkey. |
| Telephony/CPE/radio ingest | PARTIAL | NOT APPLICABLE | PARTIAL | PARTIAL | KNOWN_LIMITATIONS | PARTIAL | NEEDS OWNER | Not baseline GA promise. |
| Web UX polish | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PRODUCTION_READINESS_AUDIT | PARTIAL | NEEDS OWNER | Loading/empty/error audit not complete. |
| Desktop macOS | PARTIAL | PARTIAL | PARTIAL | PARTIAL | desktop-macos, DESKTOP_APP_API_CONTRACT | PARTIAL | NEEDS OWNER | Phase 1; refresh/release hardening. |
| Desktop Windows | PARTIAL | PARTIAL | PARTIAL | PARTIAL | desktop-windows, DESKTOP_CONNECTION_AUDIT | PARTIAL | NEEDS OWNER | Same as macOS; exe channel parity noted in audit. |
| API and Lambda maturity | PARTIAL | PARTIAL | PARTIAL | PARTIAL | template.yaml, apps/api | PARTIAL | NEEDS OWNER | Large surface; per-route maturity varies. |
| E2E automation | PARTIAL | PARTIAL | PARTIAL | NOT STARTED | PRODUCTION_READINESS_AUDIT B6 | NOT STARTED | NEEDS OWNER | Critical workflows not fully automated in-repo. |
| Edge protection / WAF | PARTIAL | PARTIAL | PARTIAL | FAIL | PRODUCTION_READINESS_AUDIT (WAF NOT FOUND) | FAIL | NEEDS OWNER | Add in template or org-level with doc trail. |
| Monitoring and paging | PARTIAL | PARTIAL | PARTIAL | PARTIAL | template alarms, monitoring-and-ops | PARTIAL | NEEDS OWNER | SNS/on-call wiring org-specific. |
| Runbooks and rollback | PARTIAL | PARTIAL | PARTIAL | PARTIAL | RUNBOOK, PILOT_READINESS | PARTIAL | NEEDS OWNER | Must be exercised for GA claim. |
| Training and SOPs | PARTIAL | PARTIAL | PARTIAL | NOT STARTED | training/, USER_GUIDE | PARTIAL | NEEDS OWNER | Materials exist; completion is org-specific. |
| SEO / public site configuration | PARTIAL | PARTIAL | PARTIAL | PARTIAL | sitemap.ts, robots.ts, audit | PARTIAL | NEEDS OWNER | `NEXT_PUBLIC_SITE_URL` must be verified in prod. |
| Public pricing safety | PASS | PASS | PASS | PASS | pricing-content.ts (quote-based) | PASS | Engineering | Explicit “no dollar amounts” in source comment. |
| Known limitations / non-goals | PASS | PASS | PASS | PASS | KNOWN_LIMITATIONS, NON_GOALS | PASS | Product + Eng | Boundaries documented; must be acknowledged per pilot. |

---

## Related documents

- [NEXT_DEPLOY_BLOCKERS.md](./NEXT_DEPLOY_BLOCKERS.md) — “What blocks the next deploy?” by environment tier.
- [ENVIRONMENT_READINESS_CHECKLIST.md](./ENVIRONMENT_READINESS_CHECKLIST.md) — per-environment copy/paste verification.
- [PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md) — evidence-based audit verdict (**PARTIAL**).

---

*This map does not replace agency counsel, DPAs, or security assessments.*
