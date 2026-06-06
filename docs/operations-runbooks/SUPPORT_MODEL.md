# Support model (pilot)

This document defines **who handles what** so pilot agencies and Rapid Cortex operators share the same vocabulary. It does **not** replace your contract’s support SLAs. **Severity and handoffs:** [ESCALATION_PATHS.md](./ESCALATION_PATHS.md) · **Evidence checklist:** [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) · **Internal L1/L2 playbook:** [ADMIN_TEAM_TROUBLESHOOTING_GUIDE.md](./ADMIN_TEAM_TROUBLESHOOTING_GUIDE.md) · **Contacts template:** [OPS_CONTACT_MATRIX.md](./OPS_CONTACT_MATRIX.md).

## Terminology

| Term | Meaning |
| --- | --- |
| **Agency** | The public-safety organization using Rapid Cortex (tenant). |
| **Tenant** | Same as agency for data isolation (`custom:agencyId` in JWT). |
| **Jurisdiction slug** | First URL path segment after the host (e.g. `columbus`); **not** the security boundary. |
| **Rapid Cortex API** | API Gateway + Lambda stack ([`infra/template.yaml`](../infra/template.yaml)). |
| **Web app** | Next.js product (`apps/web`), often at `www.rapidcortex.us`. |
| **Pilot operator** | Rapid Cortex staff or partner with platform access (where granted). |

## Support ownership (first response)

| Area | First owner | Notes |
| --- | --- | --- |
| **Agency admin** (user create, wrong role on JWT, agency id typos) | **Agency admin** + Cognito IT | In-app **Users** for standard roles; see [USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md) for UI limits. |
| **User login / MFA / password** | **Agency IT** (Cognito) | Pool, app client, hosted UI, MFA policy. |
| **403 / RBAC confusion** | **Agency admin** (expected 403 for dispatchers on admin APIs) | [ROLE_MAPPING_GUIDE.md](./ROLE_MAPPING_GUIDE.md). |
| **AI analysis** (Refresh AI errors, structured codes) | **Rapid Cortex platform** | Logs, quotas, IAM — [RUNBOOK.md](./RUNBOOK.md). |
| **Multilingual** (STT/translation/LID, `MULTILINGUAL_CONFIG_INVALID`) | **Rapid Cortex platform** | Secrets, strict mode — [RUNBOOK_MULTILINGUAL_CALLS.md](./RUNBOOK_MULTILINGUAL_CALLS.md). |
| **Vendor / provider outages** (hyperscaler or model API) | **Rapid Cortex platform** + vendor TAM | Agency notified per comms plan; Rapid Cortex does not “fix” AWS us-east-1 from the ECC floor. |
| **Deployment / web or API config** (CORS, wrong URL, env drift) | **DevOps / platform** | [DEPLOYMENT.md](./DEPLOYMENT.md), [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md). |
| **CAD / 911 CPE / radio vendor** | **That vendor’s support** | [NON_GOALS.md](./NON_GOALS.md) — Rapid Cortex is not those systems. |
| **Wrong data / legal hold** | **Agency supervision + counsel** | [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md). |

## Severity (summary)

| Level | Who declares | First action |
|-------|----------------|--------------|
| **SEV-1** | Pilot lead or on-call | Page bridge; freeze risky changes — [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md). |
| **SEV-2** | Pilot lead | Assign owner; communicate to agencies within agreed SLA. |
| **SEV-3** | Desk | Ticket + next business day unless pilot window demands faster. |

Full routing: [ESCALATION_PATHS.md](./ESCALATION_PATHS.md).

## Escalation tiers (suggested)

1. **L1 — Agency desk** — Confirm URL, browser, role, reproduce with a second account if safe ([COMMON_TASKS.md](./COMMON_TASKS.md)).
2. **L2 — Agency IT / Rapid Cortex pilot channel** — Logs, HAR, timestamps, `requestId` from API error JSON when present ([TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)).
3. **L3 — Engineering on-call** — Template rollback, PITR restore consideration, vendor cases (AWS) — [RUNBOOK.md](./RUNBOOK.md).

## Operator-visible fallback

- When Rapid Cortex is **degraded or unavailable**, floor procedures **without** the co-pilot remain authoritative ([NON_GOALS.md](./NON_GOALS.md)).
- Do not instruct users to bypass MFA or share passwords.

## Communication expectations (pilot)

- **Internal** (RC): status updates at least every **30 minutes** during SEV-1 until mitigated or declared stable.
- **External** (agency): only **approved** contacts send user-facing messages; avoid speculative root cause.
- **Post-incident**: short timeline to agency sponsor within **24–48h** for SEV-1/2 ([INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)).

## Evidence to collect before escalating

- Jurisdiction URL (full path).
- Approximate **UTC** time.
- Screenshot of **Connections** strip and any **banner** text.
- For API errors: HTTP status, response body **`error`**, **`errorCode`**, **`requestId`** when returned.

## Related documents

- [GTM_PACKAGE.md](./GTM_PACKAGE.md) — onboarding and support handoff index
- [ESCALATION_PATHS.md](./ESCALATION_PATHS.md) · [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) · [OPS_CONTACT_MATRIX.md](./OPS_CONTACT_MATRIX.md)
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)
- [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md)
- [TRAINING_DISPATCHER.md](./TRAINING_DISPATCHER.md) · [TRAINING_SUPERVISOR.md](./TRAINING_SUPERVISOR.md) · [TRAINING_ADMIN.md](./TRAINING_ADMIN.md)
- [USER_GUIDE.md](./USER_GUIDE.md)
