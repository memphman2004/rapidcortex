# Incident response (pilot)

**Incident** here means an **operational or security event** affecting Rapid Cortex (outage, data leak suspicion, auth anomaly)—not a 911 **incident record** inside the product. **Internal support desk playbook:** [ADMIN_TEAM_TROUBLESHOOTING_GUIDE.md](./ADMIN_TEAM_TROUBLESHOOTING_GUIDE.md).

## Severity (suggested)

| Level | Examples | Initial response |
| --- | --- | --- |
| **SEV-1** | API-wide 5xx, auth completely broken, confirmed data exposure | Page on-call; freeze risky changes; preserve logs. |
| **SEV-2** | Partial outage (one route), multilingual path down, elevated error rate | Assign owner; communicate to pilot agencies. |
| **SEV-3** | Single-user defect, non-prod regression | Normal backlog unless pilot window is active. |

## Product / availability incidents

1. **Detect** — CloudWatch alarms ([`MONITORING_AND_OPS.md`](./MONITORING_AND_OPS.md)), synthetic health, user reports.
2. **Triage** — [`RUNBOOK.md`](./RUNBOOK.md) “What broke → where to look” table.
3. **Mitigate** — Roll back SAM or web deploy; scale concurrency; disable a feature flag if applicable.
4. **Communicate** — Agency contacts per your comms plan.
5. **Post-incident** — Short timeline, root cause (technical), follow-up tasks; **no** blameless template required for pilot but capture learnings.

## Security incidents

1. **Contain** — Rotate suspected secrets (Cognito app config, webhook secrets, cloud keys); revoke sessions if compromise is credible.
2. **Preserve** — CloudWatch Logs, API Gateway execution logs (if enabled), **Audit** table export under counsel direction.
3. **Report** — Follow agency policy and contract; Rapid Cortex documentation does **not** assert compliance certification ([SECURITY_MODEL.md](./SECURITY_MODEL.md)).

## Communication during incidents

- Use named contacts in **[OPS_CONTACT_MATRIX.md](./OPS_CONTACT_MATRIX.md)** (fill per pilot).
- **Agency-facing** updates: factual (“we see elevated API errors”), no blame, no unverified vendor claims.
- **Severity-driven cadence:** follow [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) and [ESCALATION_PATHS.md](./ESCALATION_PATHS.md).
- After mitigation: schedule **post-incident** summary ([PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md)).

## Contacts and artifacts

- **Runbook:** [`RUNBOOK.md`](./RUNBOOK.md)
- **Rollback / data:** [`BACKUP_AND_RECOVERY.md`](./BACKUP_AND_RECOVERY.md)
- **Support routing:** [`SUPPORT_MODEL.md`](./SUPPORT_MODEL.md)
- **Escalation paths:** [ESCALATION_PATHS.md](./ESCALATION_PATHS.md)
- **Troubleshooting evidence:** [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)
