# Pilot overview — first controlled agency

**Last reviewed:** 2026-09-19 (60-day refresh) · **Owner:** Jeff Coleman  
**Canonical product definition:** [MVP_SCOPE.md](./MVP_SCOPE.md) · **Exclusions:** [NON_GOALS.md](./NON_GOALS.md) · **Operational onboarding:** [GTM_PACKAGE.md](./GTM_PACKAGE.md)

## Pilot intent

One (or tightly controlled) public-safety agency runs Rapid Cortex **in production-shaped AWS** (`rapid-cortex-dev` / `https://app.rapidcortex.us`) with **real auth**, **MFA required**, **real API**, and **human-in-the-loop** workflows. Success is **safe assistive use**, **operational credibility**, and **governance**—not feature breadth ([MVP_SCOPE.md](./MVP_SCOPE.md)).

## What the pilot includes

- Dispatcher **dashboard** (queue, transcript, intelligence, actions as implemented).
- **Supervisor** review surfaces where enabled.
- **Admin** users, audit, integration status, environment reference, and in-app **Admin → Pilot hub** at `/{slug}/admin/pilot` (onboarding links + local trackers).
- **Training / evaluation** via **`/demo`** and documented non-live modes ([NON_GOALS.md](./NON_GOALS.md) §5).
- **AI analysis** and **protocol engine** per configured providers and packs ([AI_PROVIDER_CONFIGURATION.md](../product-architecture/AI_PROVIDER_CONFIGURATION.md), [PROTOCOL_REVIEW_REQUIREMENTS.md](../security-compliance/PROTOCOL_REVIEW_REQUIREMENTS.md)).
- **Cognito MFA** on the production pool ([AUTH_OPERATIONS.md](../product-architecture/AUTH_OPERATIONS.md)).

## What the pilot explicitly does not promise

- Bidirectional **CAD** as default; **live radio ingest** as universal GA; **certified** compliance claims—see [NON_GOALS.md](./NON_GOALS.md), [KNOWN_LIMITATIONS.md](../product-architecture/KNOWN_LIMITATIONS.md), [INTEGRATIONS_CAD_AND_MOTOROLA.md](../product-architecture/INTEGRATIONS_CAD_AND_MOTOROLA.md).
- SOC 2 Type II, CJIS, HIPAA, or FedRAMP **certification**. Observation pack: [soc2/README.md](../security-compliance/soc2/README.md).

## Onboarding this pilot

1. **[AGENCY_ONBOARDING_RUNBOOK.md](../operations-runbooks/AGENCY_ONBOARDING_RUNBOOK.md)** — end-to-end from signature to first use.
2. **[AGENCY_SETUP_CHECKLIST.md](../admin-user-management/AGENCY_SETUP_CHECKLIST.md)** — agency + vendor tasks.
3. **[PILOT_KICKOFF_CHECKLIST.md](./PILOT_KICKOFF_CHECKLIST.md)** — kickoff meeting and decisions.
4. **[IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md)** — required inputs and owners.

## Measuring pilot success

See **[PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md)** for suggested metrics, cadence, and how limitations docs stay honest.

## Related

- [PILOT_READINESS_CHECKLIST.md](../deployment-infrastructure/PILOT_READINESS_CHECKLIST.md)
- [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md)
- [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md)
- [CONTRACT_PACKAGE_INDEX.md](./CONTRACT_PACKAGE_INDEX.md)
