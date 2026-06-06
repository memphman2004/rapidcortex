# Go-to-market & onboarding package

**Audience:** sales, solutions architects, implementation consultants, agency IT/ops, training leads, and support managers preparing a **real agency pilot** — not only engineering.

This file is the **operational entry point** for how Rapid Cortex is introduced, configured, trained, and supported. Technical depth defers to linked documents; scope and exclusions remain canonical in [MVP_SCOPE.md](./MVP_SCOPE.md) and [NON_GOALS.md](./NON_GOALS.md).

---

## 1. Role-based entry

| Role | Start here | Then |
|------|------------|------|
| **Sales / SE** | [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md), [FEATURE_MATRIX.md](./FEATURE_MATRIX.md), [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md), [PROMISE_CONTROL.md](./PROMISE_CONTROL.md), [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md), [PILOT_NON_GOALS.md](./PILOT_NON_GOALS.md), [FAQ_INTERNAL.md](./FAQ_INTERNAL.md), [MVP_SCOPE.md](./MVP_SCOPE.md), [NON_GOALS.md](./NON_GOALS.md) | [phase-0/product-one-pager.md](./phase-0/product-one-pager.md) for tone; `/demo` for scripted walkthroughs only. |
| **Implementation / DevOps** | [IMPLEMENTATION_ASSUMPTIONS.md](./IMPLEMENTATION_ASSUMPTIONS.md), [INSTALLATION.md](./INSTALLATION.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md) | [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md), [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md), [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md), [RUNBOOK.md](./RUNBOOK.md). |
| **County / city / municipality (IT + comms)** | **[JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md)** — install on screens, setup, maintenance, troubleshooting; **Appendix A** lists files to ship in the agency **download package** | [USER_GUIDE.md](./USER_GUIDE.md), [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md), [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md), [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md). |
| **Agency admin** | In-app **Admin → Pilot hub** (`/admin/pilot`), **Admin → Configuration** (`/admin/configuration`), [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) | [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md), [USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md), [AGENCY_SETUP_CHECKLIST.md](./AGENCY_SETUP_CHECKLIST.md), [training/PILOT_AGENCY_ADMIN_CHECKLIST.md](./training/PILOT_AGENCY_ADMIN_CHECKLIST.md), [COGNITO_SELF_SIGNUP.md](./COGNITO_SELF_SIGNUP.md) if self-signup. |
| **Training lead** | [USE_CASES.md](./USE_CASES.md), [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md), [TRAINING_DISPATCHER.md](./TRAINING_DISPATCHER.md), [TRAINING_SUPERVISOR.md](./TRAINING_SUPERVISOR.md), [TRAINING_ADMIN.md](./TRAINING_ADMIN.md), [QUICKSTART_CARD.md](./QUICKSTART_CARD.md), [USER_GUIDE.md](./USER_GUIDE.md) | [FIRST_DAY_CHECKLIST.md](./FIRST_DAY_CHECKLIST.md), [COMMON_TASKS.md](./COMMON_TASKS.md), [training/PILOT_DISPATCHER_CHECKLIST.md](./training/PILOT_DISPATCHER_CHECKLIST.md), [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md). |
| **Support / NOC** | [SUPPORT_MODEL.md](./SUPPORT_MODEL.md), [ESCALATION_PATHS.md](./ESCALATION_PATHS.md), [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md), [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) | [OPS_CONTACT_MATRIX.md](./OPS_CONTACT_MATRIX.md), [PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md), [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md), [FEEDBACK_LOOP.md](./FEEDBACK_LOOP.md), [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md), [FAQ_INTERNAL.md](./FAQ_INTERNAL.md), [RUNBOOK.md](./RUNBOOK.md), [MONITORING_AND_OPS.md](./MONITORING_AND_OPS.md). |

---

## 2. Nine-step lifecycle (evaluation → expansion)

Use this sequence in customer-facing project plans. Checkboxes for working sessions can be tracked in the product at **Admin → Pilot hub** (browser-local); keep contractual sign-off in your SOW / playbook.

1. **Introduce** — Position Rapid Cortex as **assistive**, human-in-the-loop co-pilot; align on [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md) and [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md).
2. **Explain does / does not** — Walk [MVP_SCOPE.md](./MVP_SCOPE.md), [NON_GOALS.md](./NON_GOALS.md), [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).
3. **Configure pilot tenant** — Agency row, Cognito claims, stack per [INSTALLATION.md](./INSTALLATION.md) / [AWS_SETUP.md](./AWS_SETUP.md).
4. **Onboard pilot admins** — **Admin → Pilot hub**, [ADMIN_GUIDE.md](./ADMIN_GUIDE.md), integrations status.
5. **Provision users** — **Admin → Users**; correct `custom:agencyId` and `custom:role` ([AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md)).
6. **Train dispatchers & supervisors** — [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md), [USER_GUIDE.md](./USER_GUIDE.md); use **`/demo`** only for scripted exercises ([NON_GOALS.md](./NON_GOALS.md) §5).
7. **Support early usage** — [SUPPORT_MODEL.md](./SUPPORT_MODEL.md); capture `requestId` and UTC timestamps.
8. **Review feedback** — Structured issues; update [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) when new boundaries are discovered.
9. **Expand carefully** — [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md) before new jurisdictions; no reliance on demo-only assumptions ([DEMO_DEBT_INVENTORY.md](./DEMO_DEBT_INVENTORY.md)).

---

## 2a. Agency download package (county / city / municipality)

Ship **[JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md)** with each jurisdiction: it is the **cover guide** for IT + administrators and includes **Appendix A** — a checklist of companion `docs/` files to zip (or print) together for that agency’s binder or secure file share.

---

## 2b. Sales vocabulary, CAD positioning, and packaging tiers

**CAD vs Rapid Cortex (use in every pilot kickoff):**

- **CAD / 911 CPE / radio / RMS** — system of record for call handling, units, and official records.
- **Rapid Cortex** — **assistive** layer: AI + human-in-the-loop for **transcription**, **multilingual** speech-to-text (10+ languages when configured), **real-time translation**, **AI-assisted triage and summaries**, **dispatcher guidance**, **supervisor QA**, **live video / media intake** (when enabled), **silent text / text-style session** patterns, and **audit** trails. It **does not replace CAD**; it **enhances** workflows alongside it. Unsupervised CAD write-back is **out of scope** for typical pilots unless reopened with legal and vendor review ([NON_GOALS.md](./NON_GOALS.md)).

**Plan names (product UI vs sales shorthand):**

| Public / product name (app & marketing) | Sales shorthand (optional) |
|----------------------------------------|----------------------------|
| Essential | **Core** |
| Professional | **Pro** |
| Command | **Command** |
| Enterprise | **Enterprise** |

**Admin desktop apps (installers):** not public URLs. Authorized roles use **Admin → Settings → Downloads → Desktop Apps** (presigned short-lived URLs). Technical contract: [DESKTOP_DOWNLOAD_FLOW.md](./DESKTOP_DOWNLOAD_FLOW.md), [DESKTOP_APP_API_CONTRACT.md](./DESKTOP_APP_API_CONTRACT.md).

---

## 3. Launch artifacts (checklists)

| Artifact | Use |
|----------|-----|
| [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) | Master **pre-go-live** governance + technical gate |
| [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md) | Stack + functional smoke + rollback readiness |
| [PILOT_READINESS.md](./PILOT_READINESS.md) | Short index to the above and training checklists |
| [AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md) | Per-agency URLs, contacts, escalation |
| [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md) | Signed pilot → first use (operations) |
| [JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md) | **Ship with each jurisdiction:** install/setup/maintenance/troubleshooting + ZIP manifest (Appendix A) |
| [PILOT_KICKOFF_CHECKLIST.md](./PILOT_KICKOFF_CHECKLIST.md) | First joint meeting decisions |
| [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md) | Per-agency workbook (copy, do not drift scope) |
| [PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md) | Metrics + feedback index |
| [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md) | Measurable pilot indicators |
| [FEEDBACK_LOOP.md](./FEEDBACK_LOOP.md) | Collection channels + cadence |
| [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md) | Fortnightly review agenda |
| [PROMISE_CONTROL.md](./PROMISE_CONTROL.md) | Internal promise / claim discipline |
| [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md) | Role boundaries + safe phrasing |
| [PILOT_NON_GOALS.md](./PILOT_NON_GOALS.md) | Pilot “never promise” operational list |
| [FAQ_INTERNAL.md](./FAQ_INTERNAL.md) | Internal Q&A for sales/support |

---

## 4. In-product packaging

- **Admin → Pilot hub** (`/{slug}/admin/pilot`) — Links to canonical docs (optional hosted URL via `NEXT_PUBLIC_DOCUMENTATION_BASE_URL`), admin shortcuts, demo vs production reminder, **agency onboarding milestones** (ordered runbook tracker), a **local GTM phase tracker**, and a **pilot readiness attention** strip when integration status reports blockers.
- **Admin → Configuration** (`/{slug}/admin/configuration`) — Read-only **public web env** + pilot UX flags + embedded integration status (not a remote-config editor).
- **Admin → Integrations** — Live `GET /api/integration/status` for pilot readiness signals.

---

## 5. Internal sales/demo consistency

- **Production-shaped evaluation:** use a **staging or pilot** stack with real API and auth — not `NEXT_PUBLIC_OFFLINE_DEMO_MODE` on shared pilot hosts.
- **Scripted demos:** **`/demo`** and [NON_GOALS.md](./NON_GOALS.md) §5; do not imply live CAD/radio ingest where adapters are not deployed ([INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)).

---

## 6. Related documents

- [CORE_USER_FLOWS.md](./CORE_USER_FLOWS.md) — UI ↔ API wiring
- [API_SURFACE.md](./API_SURFACE.md) — RBAC per route
- [SECURITY_MODEL.md](./SECURITY_MODEL.md) — Pilot technical posture (not certification claims)
- [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md) — Data handling expectations
