# Pilot readiness — hub

**Controlled first-agency launch** readiness is split so a single source does not drift:

| Document | Purpose |
|----------|---------|
| [PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md) | **Repo-wide production / pilot audit** — status by area, checklist, blockers (not a certification) |
| [GTM_PACKAGE.md](./GTM_PACKAGE.md) | **GTM & onboarding package** — sales, implementation, training, support entry (in-app: **Admin → Pilot hub**) |
| [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md) | **Promise vs out of scope** — SE / buyer alignment |
| [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md), [PILOT_OVERVIEW.md](./PILOT_OVERVIEW.md) | Sales-ready and pilot-specific overviews |
| [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) | **Maturity** by capability |
| [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md) | Signed pilot → first use |
| [PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md) | Metrics and feedback loop |
| [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md) | Admin workflows + `/admin/configuration` |
| [PILOT_CONFIGURATION_MODEL.md](./PILOT_CONFIGURATION_MODEL.md) | Configuration layering |
| [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) | Web + Lambda flags |
| [TRAINING_DISPATCHER.md](./TRAINING_DISPATCHER.md), [TRAINING_SUPERVISOR.md](./TRAINING_SUPERVISOR.md), [TRAINING_ADMIN.md](./TRAINING_ADMIN.md) | Live-UI training (no screenshots) |
| [QUICKSTART_CARD.md](./QUICKSTART_CARD.md), [FIRST_DAY_CHECKLIST.md](./FIRST_DAY_CHECKLIST.md), [COMMON_TASKS.md](./COMMON_TASKS.md) | Rollout quickstart + day-one + tasks |
| [ESCALATION_PATHS.md](./ESCALATION_PATHS.md), [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md), [OPS_CONTACT_MATRIX.md](./OPS_CONTACT_MATRIX.md) | Support readiness |
| [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) | **Master checklist** — run before declaring pilot-ready |
| [MVP_SCOPE.md](./MVP_SCOPE.md) | MVP scope, pilot story, roles, assistive AI definition |
| [NON_GOALS.md](./NON_GOALS.md) | Explicit exclusions (MVP + pilot) |
| [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md) | RBAC, data classification, AI framing |
| [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md) | Stored vs not stored; retention / export / delete |
| [PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md) | Protocol guidance dependency |
| [AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md) | Per-agency operational template |

Training checklists: [training/PILOT_AGENCY_ADMIN_CHECKLIST.md](./training/PILOT_AGENCY_ADMIN_CHECKLIST.md), [training/PILOT_DISPATCHER_CHECKLIST.md](./training/PILOT_DISPATCHER_CHECKLIST.md) — plus narrative guides above and [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md).

---

**Live integration status** (authenticated): `GET /api/integration/status` — surfaced in **Admin → Integrations** when the web app is API-connected.
