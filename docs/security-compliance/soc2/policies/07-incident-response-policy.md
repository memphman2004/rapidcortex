# POL-07 Incident response policy

| Field | Value |
|-------|--------|
| Policy ID | POL-07 |
| TSC | CC7.3, CC7.4, CC2.3 |
| Owner | Jeff Coleman (interim security lead) |
| Approver | Management |
| Effective | DRAFT 2026-09-19 |
| Review | Annual + after every SEV-1 |

**Not a Type II report.** “Incident” here is an operational or security event affecting Rapid Cortex — not a 911 incident record in the product.

## 1. Severity

| Level | Examples | Response |
|-------|----------|----------|
| **SEV-1** | Confirmed data exposure, auth completely broken, mass tenant leak, deploy keys leaked | Page on-call immediately; freeze risky deploys; preserve logs |
| **SEV-2** | Partial outage, WAF/auth anomaly, single-agency data issue | Owner in 1 hour (business) / 4 hours (off-hours as staffed) |
| **SEV-3** | Single-user defect, non-prod | Backlog |

Paging is operator-owned (PLT-025). Until a 24/7 SOC add-on is purchased, coverage is documented on-call hours — do not claim a staffed SOC.

## 2. Process (summary)

1. **Detect** — CloudWatch, WAF, CloudTrail, user report, deception events.
2. **Triage** — [INCIDENT_RESPONSE.md](../../../operations-runbooks/INCIDENT_RESPONSE.md), [INCIDENT_RESPONSE_RUNBOOK.md](../../../operations-runbooks/INCIDENT_RESPONSE_RUNBOOK.md), [SECURITY_TRIAGE_PROCESS.md](../../SECURITY_TRIAGE_PROCESS.md).
3. **Contain** — disable users, rotate secrets (ticketed SOP), feature-flag off, rollback.
4. **Preserve** — CloudTrail, CloudWatch, audit table export under counsel. **No full transcripts in tickets.**
5. **Eradicate / recover** — patch, redeploy previous git tag if needed.
6. **Communicate** — agencies per DPA/MSA; factual status only.
7. **Post-incident** — timeline, root cause, follow-ups within 10 business days for SEV-1/2.

## 3. Tabletop

At least **annually**, and once **before** the Type II window: [incident-response-tabletop.md](../processes/incident-response-tabletop.md). Log attendees (names off-git if needed) and findings in [tabletop-log.md](../evidence/tabletop-log.md).
