# Pilot readiness — hub

**Controlled first-agency launch** readiness is split so a single source does not drift:

| Document | Purpose |
|----------|---------|
| [PRODUCTION_READINESS_AUDIT.md](../security-compliance/PRODUCTION_READINESS_AUDIT.md) | **Repo-wide production / pilot audit** — status by area, checklist, blockers (not a certification) |
| [GTM_PACKAGE.md](../go-to-market-sales/GTM_PACKAGE.md) | **GTM & onboarding package** — sales, implementation, training, support entry (in-app: **Admin → Pilot hub**) |
| [GTM_EXECUTION_PLAN.md](../go-to-market-sales/GTM_EXECUTION_PLAN.md) | **90-day** pilot-first execution plan |
| [CONTRACT_PACKAGE_INDEX.md](../go-to-market-sales/CONTRACT_PACKAGE_INDEX.md) | Contracts and trust artifacts to send when |
| [DOCUMENT_GAPS.md](../go-to-market-sales/DOCUMENT_GAPS.md) | Missing / draft artifact tracker |
| [SALES_SCOPE_MATRIX.md](../go-to-market-sales/SALES_SCOPE_MATRIX.md) | **Promise vs out of scope** — SE / buyer alignment |
| [PRODUCT_OVERVIEW.md](../go-to-market-sales/PRODUCT_OVERVIEW.md), [PILOT_OVERVIEW.md](../go-to-market-sales/PILOT_OVERVIEW.md) | Sales-ready and pilot-specific overviews |
| [FEATURE_MATRIX.md](../go-to-market-sales/FEATURE_MATRIX.md) | **Maturity** by capability |
| [AGENCY_ONBOARDING_RUNBOOK.md](../operations-runbooks/AGENCY_ONBOARDING_RUNBOOK.md) | Signed pilot → first use |
| [PILOT_SUCCESS_AND_FEEDBACK.md](../go-to-market-sales/PILOT_SUCCESS_AND_FEEDBACK.md) | Metrics and feedback loop |
| [ADMIN_SETUP_GUIDE.md](../admin-user-management/ADMIN_SETUP_GUIDE.md) | Admin workflows + `/admin/configuration` |
| [PILOT_CONFIGURATION_MODEL.md](../go-to-market-sales/PILOT_CONFIGURATION_MODEL.md) | Configuration layering |
| [FEATURE_FLAGS.md](../product-architecture/FEATURE_FLAGS.md) | Web + Lambda flags |
| [TRAINING_DISPATCHER.md](../operations-runbooks/TRAINING_DISPATCHER.md), [TRAINING_SUPERVISOR.md](../operations-runbooks/TRAINING_SUPERVISOR.md), [TRAINING_ADMIN.md](../operations-runbooks/TRAINING_ADMIN.md) | Live-UI training (no screenshots) |
| [QUICKSTART_CARD.md](../operations-runbooks/QUICKSTART_CARD.md), [FIRST_DAY_CHECKLIST.md](../operations-runbooks/FIRST_DAY_CHECKLIST.md), [COMMON_TASKS.md](../operations-runbooks/COMMON_TASKS.md) | Rollout quickstart + day-one + tasks |
| [ESCALATION_PATHS.md](../operations-runbooks/ESCALATION_PATHS.md), [TROUBLESHOOTING_GUIDE.md](../operations-runbooks/TROUBLESHOOTING_GUIDE.md), [OPS_CONTACT_MATRIX.md](../operations-runbooks/OPS_CONTACT_MATRIX.md) | Support readiness |
| [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) | **Master checklist** — run before declaring pilot-ready |
| [MVP_SCOPE.md](../go-to-market-sales/MVP_SCOPE.md) | MVP scope, pilot story, roles, assistive AI definition |
| [NON_GOALS.md](../go-to-market-sales/NON_GOALS.md) | Explicit exclusions (MVP + pilot) |
| [PILOT_GOVERNANCE.md](../go-to-market-sales/PILOT_GOVERNANCE.md) | RBAC, data classification, AI framing |
| [PRIVACY_RETENTION_DECISIONS.md](../security-compliance/PRIVACY_RETENTION_DECISIONS.md) | Stored vs not stored; retention / export / delete |
| [PROTOCOL_REVIEW_REQUIREMENTS.md](../security-compliance/PROTOCOL_REVIEW_REQUIREMENTS.md) | Protocol guidance dependency |
| [AGENCY_PLAYBOOK_TEMPLATE.md](../admin-user-management/AGENCY_PLAYBOOK_TEMPLATE.md) | Per-agency operational template |

Training checklists: [training/PILOT_AGENCY_ADMIN_CHECKLIST.md](../training/PILOT_AGENCY_ADMIN_CHECKLIST.md), [training/PILOT_DISPATCHER_CHECKLIST.md](../training/PILOT_DISPATCHER_CHECKLIST.md), [training/PILOT_SUPERVISOR_CHECKLIST.md](../training/PILOT_SUPERVISOR_CHECKLIST.md) — plus narrative guides above and [TRAINING_QUICKSTART.md](../operations-runbooks/TRAINING_QUICKSTART.md).

---

**Live integration status** (authenticated): `GET /api/integration/status` — surfaced in **Admin → Integrations** when the web app is API-connected.
