# Troubleshooting guide (pilot)

**Principles:** reproduce safely, capture evidence once, route per [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) and [ESCALATION_PATHS.md](./ESCALATION_PATHS.md). Deep ops: [RUNBOOK.md](./RUNBOOK.md). **Internal admin team playbook (intake, severity, scripts, RCA):** [ADMIN_TEAM_TROUBLESHOOTING_GUIDE.md](./ADMIN_TEAM_TROUBLESHOOTING_GUIDE.md).

## Data to collect (before any escalation)

| Item | Why |
|------|-----|
| Full **URL** path | Jurisdiction slug + route |
| **UTC** timestamp | Correlates CloudWatch |
| **Role** (`custom:role`) and rough user id (email ok if policy allows) | RBAC |
| **Incident id** (if applicable) | API logs |
| Screenshot of **Connections** strip | Shows API client config |
| API error: **`error`**, **`errorCode`**, **`requestId`** | Lambda support |

## Symptom → checks

### “API offline” / empty queue with no incidents

1. **Connections** — if API dot not **live**, web env is wrong or proxy unreachable ([INSTALLATION.md](./INSTALLATION.md)).
2. If API live but queue empty — confirm you are not on **`NEXT_PUBLIC_OFFLINE_DEMO_MODE=1`** by mistake ([ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)).
3. If still wrong — DevOps: `GET /api/health`, auth smoke ([PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md)).

### 403 on admin or integrations

- **Expected** for `dispatcher` on integration status API.
- If **admin** gets 403 — JWT role claim wrong; fix in Cognito ([USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md)).

### Intelligence / Refresh AI errors

- Read user-visible message (e.g. transcript unchanged, rate limit).
- Platform: analyze Lambda logs, `AnalyzeIncidentErrorsAlarm` ([RUNBOOK.md](./RUNBOOK.md)).

### Multilingual config issues > 0

- Open **Admin → Configuration** summary.
- Platform: secrets ARNs, `MULTILINGUAL_STRICT_VALIDATION`, [`RUNBOOK_MULTILINGUAL_CALLS.md`](./RUNBOOK_MULTILINGUAL_CALLS.md).

### Interpreter review everywhere / none when expected

- **Pipeline tuning** issue — not a dispatcher UI bug; internal ops + agency program review thresholds ([LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md)).

### Login loops / refresh failures

- Cognito app client, callback URLs, cookie domain — Agency IT + [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md).

## Operator-visible fallback guidance

- **Continue operations without Rapid Cortex** when API is down—product is assistive, not SoR ([NON_GOALS.md](./NON_GOALS.md)).
- **Do not disable MFA** as a workaround without security sign-off.

## Related

- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)
- [OPS_CONTACT_MATRIX.md](./OPS_CONTACT_MATRIX.md)
