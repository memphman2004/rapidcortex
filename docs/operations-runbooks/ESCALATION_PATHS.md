# Escalation paths (pilot)

**Companion:** [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) (first responder matrix). This page orders **when** to move from agency desk → IT → Rapid Cortex → engineering. **Internal operational playbook:** [ADMIN_TEAM_TROUBLESHOOTING_GUIDE.md](./ADMIN_TEAM_TROUBLESHOOTING_GUIDE.md).

## Severity (aligns with [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md))

| Level | Meaning | Example | Notify |
|-------|---------|---------|--------|
| **SEV-1** | Pilot-wide unusable or suspected breach | API 5xx for all, auth broken for all | On-call + agency sponsor **immediately** |
| **SEV-2** | Major feature impaired | Multilingual path down; AI analyze failing for many | Pilot channel within **30 min** |
| **SEV-3** | Single user / single incident | One browser profile, one 403 misconfig | L1 desk; ticket |

## Path by problem class

### Agency admin issues (users, roles, wrong agency on JWT)

1. **Agency admin** verifies Cognito attributes and admin UI **Users** row.
2. If pool policy / MFA blocks — **Agency IT**.
3. If API returns persistent `FORBIDDEN` despite correct attributes — **Rapid Cortex pilot** with HAR + `requestId`.

### Login / MFA / password

1. **Agency IT** (Cognito).
2. If pool miswired to wrong app client for this web host — **DevOps** with stack outputs.

### AI analysis failures

1. Dispatcher captures **error text + `requestId` + UTC + incident id**.
2. **Supervisor** confirms widespread vs one-off.
3. **Rapid Cortex** checks Lambda logs / quotas ([RUNBOOK.md](./RUNBOOK.md) “AI analyze failures”).

### Multilingual / translation / STT

1. Confirm **Admin → Configuration / Integrations** issue count.
2. **Rapid Cortex** secrets + [`RUNBOOK_MULTILINGUAL_CALLS.md`](./RUNBOOK_MULTILINGUAL_CALLS.md).

### Vendor / provider outages (OpenAI, Bedrock, Azure, Google)

1. Check vendor status pages.
2. **Rapid Cortex** may switch tiers or declare degraded mode per runbook — **not** agency IT alone.

### Deployment / config (CORS, wrong API URL, feature flag)

1. **DevOps** compares web env to [`ENVIRONMENT_MATRIX.md`](./ENVIRONMENT_MATRIX.md).
2. Roll back web or API per [RUNBOOK.md](./RUNBOOK.md).

## When to pull engineering on-call (L3)

- SEV-1 / SEV-2 unresolved after agreed timebox.
- Any suspected **data integrity** or **security** issue ([INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)).

## Related

- [OPS_CONTACT_MATRIX.md](./OPS_CONTACT_MATRIX.md) — fill in names/Slack/phone.
- [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)
