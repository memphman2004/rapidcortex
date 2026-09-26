# Pilot success measurement and feedback loop

**Last reviewed:** 2026-09-19 (60-day refresh) · **Owner:** Jeff Coleman

**Purpose:** index for **how** a pilot is judged and **how** learning flows back into product and documentation without overselling. Governance framing: [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md). Support routing: [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md).

## Canonical splits (read these first)

| Document | Contents |
|----------|----------|
| [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md) | Measurable indicators, data sources, what the product exposes |
| [FEEDBACK_LOOP.md](./FEEDBACK_LOOP.md) | Collection channels, cadence, outputs, doc updates |
| [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md) | Fortnightly joint meeting agenda |

## Success dimensions (balanced scorecard)

| Dimension | Example signals | Owner |
|-----------|-----------------|-------|
| **Safety & governance** | No autonomous dispatch; MFA enrolled; escalations follow SOP; audit samples clean | Agency supervision + RC pilot lead |
| **Operational credibility** | API uptime within agreed window; integration status without unresolved config errors | DevOps / platform |
| **Human-in-the-loop** | Supervisors review flagged incidents within agreed cadence | Agency |
| **Usability** | Dispatchers complete scripted tasks on staging/pilot ([TRAINING_QUICKSTART.md](../operations-runbooks/TRAINING_QUICKSTART.md)) | Training lead |
| **Learning velocity** | Structured retro notes; [KNOWN_LIMITATIONS.md](../product-architecture/KNOWN_LIMITATIONS.md) updated when new boundaries found | PM + engineering |

Qualitative metrics from [phase-0/product-one-pager.md](../phase-0/product-one-pager.md) (dispatcher trust, supervisor trust) remain valid **as qualitative**—do not convert to contractual SLAs unless procurement agrees.

## Minimum instrumentation (technical)

- Capture **`requestId`** and UTC timestamps for API errors ([SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md)).
- Tag releases / **`GIT_SHA` or `REVISION`** on Lambdas when traceability required ([RUNBOOK.md](../operations-runbooks/RUNBOOK.md)).
- Use **CloudWatch dashboard + alarms** agreed for the pilot stage ([MONITORING_AND_OPS.md](../operations-runbooks/MONITORING_AND_OPS.md)).

## Promise control

- Any new externally facing claim must be checked against **[PROMISE_CONTROL.md](./PROMISE_CONTROL.md)**, **[SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md)**, and **[NON_GOALS.md](./NON_GOALS.md)**.
- If marketing or SE needs a one-pager, start from **[PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)**—not from roadmap slides alone.
- Do not claim SOC 2 Type II. Point to [soc2/README.md](../security-compliance/soc2/README.md) as an observation pack only.

## Related

- [PILOT_KICKOFF_CHECKLIST.md](./PILOT_KICKOFF_CHECKLIST.md)
- [AGENCY_PLAYBOOK_TEMPLATE.md](../admin-user-management/AGENCY_PLAYBOOK_TEMPLATE.md)
