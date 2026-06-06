# Pilot overview — first controlled agency

**Canonical product definition:** [MVP_SCOPE.md](./MVP_SCOPE.md) · **Exclusions:** [NON_GOALS.md](./NON_GOALS.md) · **Operational onboarding:** [GTM_PACKAGE.md](./GTM_PACKAGE.md)

## Pilot intent

One (or tightly controlled) public-safety agency runs Rapid Cortex **in production-shaped AWS** with **real auth**, **real API**, and **human-in-the-loop** workflows. Success is **safe assistive use**, **operational credibility**, and **governance**—not feature breadth ([MVP_SCOPE.md](./MVP_SCOPE.md)).

## What the pilot includes

- Dispatcher **dashboard** (queue, transcript, intelligence, actions as implemented).
- **Supervisor** review surfaces where enabled.
- **Admin** users, audit, integration status, environment reference, and in-app **Admin → Pilot hub** at `/{slug}/admin/pilot` (onboarding links + local trackers).
- **Training / evaluation** via **`/demo`** and documented non-live modes ([NON_GOALS.md](./NON_GOALS.md) §5).
- **AI analysis** and **protocol engine** per configured providers and packs ([AI_PROVIDER_CONFIGURATION.md](./AI_PROVIDER_CONFIGURATION.md), [PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)).

## What the pilot explicitly does not promise

- Bidirectional **CAD** as default; **live radio ingest** as universal GA; **certified** compliance claims—see [NON_GOALS.md](./NON_GOALS.md), [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md), [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md).

## Onboarding this pilot

1. **[AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md)** — end-to-end from signature to first use.
2. **[AGENCY_SETUP_CHECKLIST.md](./AGENCY_SETUP_CHECKLIST.md)** — agency + vendor tasks.
3. **[PILOT_KICKOFF_CHECKLIST.md](./PILOT_KICKOFF_CHECKLIST.md)** — kickoff meeting and decisions.
4. **[IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md)** — required inputs and owners.

## Measuring pilot success

See **[PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md)** for suggested metrics, cadence, and how limitations docs stay honest.

## Related

- [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md)
- [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md)
- [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md)
