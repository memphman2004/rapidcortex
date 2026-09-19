# Operations contact matrix

**Do not commit** agency phone numbers or personal emails to a public repo. Keep agency-side rows in your **internal** workbook; update when on-call rotations change.

Rapid Cortex platform rows filled 2026-09-19 (interim combined owner). Detail: [soc2/evidence/2026-09-19-prewindow/02-owners.md](../security-compliance/soc2/evidence/2026-09-19-prewindow/02-owners.md).

| Role | Name | Email / handle | Phone | Hours / timezone | Backup |
|------|------|----------------|-------|------------------|--------|
| Agency executive sponsor | _per pilot, off-git_ | | | | |
| Agency IT / Cognito owner | _per pilot, off-git_ | | | | |
| Floor supervisor (primary) | _per pilot, off-git_ | | | | |
| Rapid Cortex pilot lead | Jeff Coleman | `support@rapidcortex.us` | off-git | US Eastern | none yet (R-SOC-015) |
| Rapid Cortex on-call / paging bridge | Jeff Coleman | `support@rapidcortex.us` + SNS OpsAlerts | off-git | Business hours + best-effort | none yet |
| Cloud / AWS account owner | Jeff Coleman | GitHub `memphman2004`; IAM `rapid-cortex-deploy` | off-git | US Eastern | read-only `rapid-cortex-soc2-auditor` |
| Security / privacy | Jeff Coleman | `privacy@rapidcortex.us` | off-git | US Eastern | none yet |

**External vendors (reference only):** document links to AWS Support, Azure/Google portals, and model provider status dashboards in your runbook—not in this template.

**External vendors (reference only):** document links to AWS Support, Azure/Google portals, and model provider status dashboards in your runbook—not in this template.

## Escalation shortcuts

- **User-facing incident comms** — agency sponsor approves wording before mass email to floor.
- **Technical status page** — optional; if unused, use agreed **Slack / Teams** channel only.

## Related

- [ESCALATION_PATHS.md](./ESCALATION_PATHS.md)
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)
