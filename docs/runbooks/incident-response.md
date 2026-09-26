# Operational incident response runbook

**Date:** 2026-09-23  
**Product:** NexCort iQ (`rapid-cortex-*` AWS resources)  
**Audience:** Engineering on-call / PagerDuty responder  
**Related:** [Security IR runbook](../operations-runbooks/INCIDENT_RESPONSE_RUNBOOK.md) · [Monitoring & ops](../operations-runbooks/MONITORING_AND_OPS.md) · [Backup & recovery](../operations-runbooks/BACKUP_AND_RECOVERY.md)

This document covers **platform availability / reliability** incidents (Lambda, DynamoDB, Cognito, media S3). For suspected breach / account compromise, follow the security runbook linked above.

## Severity (P0–P3)

| Sev | Definition | Response |
| --- | --- | --- |
| **P0** | Live call-taking / dispatch workspace unavailable for one or more agencies; widespread 5xx; auth completely down | Page on-call (PagerDuty); freeze non-hotfix deploys; war-room channel; customer comms owner engaged |
| **P1** | Major degradation — elevated errors/latency, single vertical down, or PITR/restore needed within hours | Page on-call; mitigate within 30 minutes; status updates every 30 minutes |
| **P2** | Partial impact — one Lambda path, DLQ depth, or Cognito intermittent failures; workaround exists | Ticket + business-hours escalate; fix / roll forward within 1 business day |
| **P3** | Low impact — single alarm flap, non-prod only, or cosmetic | Backlog; no page |

**Contacts:** Use the configured **PagerDuty / on-call schedule** and SNS `OpsAlertsTopic` subscribers. Do **not** invent personal phone numbers in this doc — keep numbers only in the private ops contact matrix / PagerDuty.

**Ops signal bus:** CloudWatch alarms → SNS `OpsAlertsTopic` (stack output `OpsAlertsTopicArn`). DLQ depth also emits custom metric `RapidCortex/DLQ` / `DLQMessageCount` via `rapid-cortex-dlq-review-<stage>`.

---

## Runbook A — Lambda errors

### Signals

- Alarms such as `rapid-cortex-features-http-errors-<stage>`, `rapid-cortex-features-checkin-errors-<stage>`, `rapid-cortex-*-cad-bridge-*-errors-<stage>`, `AnalyzeIncidentErrorsAlarm`, `HttpApi5xxAlarm` (see [MONITORING_AND_OPS.md](../operations-runbooks/MONITORING_AND_OPS.md)).
- Dashboard: `rapid-cortex-<DeploymentStage>-ops`.
- Log groups: `/aws/lambda/<FunctionName>` (often `rapid-cortex-…-<stage>`).

### Triage

1. Confirm **scope**: one function vs many; one stage (`dev` = live production app.rapidcortex.us) vs staging.
2. Open the alarm → **View in Metrics** → correlate with API Gateway 5xx on the matching HttpApi.
3. In CloudWatch Logs Insights, filter `@message like /ERROR|Unhandled|Task timed out/` for the last 15 minutes. Prefer `requestId` / `X-Request-Id` — **do not** paste transcripts, CAD payloads, or PII into tickets.
4. Check recent deploys (`sam deploy` / ECS web) and feature flags (especially CAD write-back — fail-closed by default).

### Mitigate

- **Bad deploy:** roll back to last known-good package / git tag; CloudFormation auto-rollback if update failed mid-flight.
- **Dependency outage (Bedrock, Transcribe, external CAD):** enable mock/dev paths only in non-prod; in prod, disable the failing path via flag or route if available; communicate degraded mode.
- **Throttle / concurrency:** raise reserved concurrency only with capacity review; otherwise shed non-critical scheduled workers temporarily.

### Close

Confirm error rate back under threshold for 2 evaluation periods; post short RCA in the incident channel; file follow-up if DLQ has poison messages (`RapidCortex/DLQ`).

---

## Runbook B — DynamoDB throttles / capacity errors

### Signals

- DynamoDB `UserErrors` / `SystemErrors` / `ThrottledRequests` on tables such as `rapid-cortex-incidents-<stage>`, `rapid-cortex-transcripts-<stage>`, `rapid-cortex-audit-<stage>`, `rapid-cortex-agencies-<stage>`.
- Alarms: `IncidentsTableUserErrorsAlarm`, `TranscriptsTableUserErrorsAlarm`.
- Lambda logs showing `ProvisionedThroughputExceededException` or `ThrottlingException` (rare on PAY_PER_REQUEST; more often hot-partition / account limits).

### Triage

1. Identify **table + GSI** from the exception or metric dimensions.
2. Check for a **hot partition** (single `agencyId` / incident fan-out) vs account-level limit.
3. Confirm PITR is enabled (expected on data-layer tables) before any restore discussion — see [BACKUP_AND_RECOVERY.md](../operations-runbooks/BACKUP_AND_RECOVERY.md).

### Mitigate

- Reduce write amplifiers (batch jobs, scheduled scans); pause non-critical workers.
- For PAY_PER_REQUEST: open AWS Support / raise account table throughput quotas if Sustained throttling.
- Do **not** point production at a restored table without change control. Use `scripts/soc2-restore-drill.sh` (new table name only) or `scripts/dr-test.sh` for verification.

### Close

Throttle metrics clear; document partition key pattern if hot-key caused the event.

---

## Runbook C — Cognito failures (sign-in / authorizer)

### Signals

- Spike of **401/403** on `/api/auth/signin`, `/api/me`, or API Gateway JWT authorizer failures.
- ECS web logs (`/ecs/rapid-cortex-web-<stage>`): `[signin]` errors; Cognito `TooManyRequestsException` → HTTP 429.
- User reports: cannot reach post-login destinations (`/{jurisdiction}/dashboard`, `/app/venue/…`, etc.).

### Triage

1. Confirm Cognito **User Pool** and **App Client** IDs match stack outputs (`UserPoolId`, `UserPoolClientId`, `CognitoIssuer`) for the stage — mis-pointed env after deploy is a common cause.
2. Check Cognito console: service health, advanced security / lockout, recent app-client secret rotation.
3. Differentiate **invalid credentials** (quiet 401) vs **upstream Cognito/API errors** (logged `[signin]`).
4. WAF / CSP: login-page CSP violations can look like “auth broken” — see MONITORING_AND_OPS hosted-web section.

### Mitigate

- Revert web/API env to last good Cognito issuer/client if misconfigured.
- If a client secret leaked: rotate in Cognito + Secrets Manager; redeploy consumers.
- For lockout storms: pause synthetic auth probes; engage identity owner via PagerDuty — do not disable MFA/security features ad hoc on prod without approval.

### Close

Sign-in success rate restored; update ops notes if issuer/client IDs changed.

---

## Runbook D — Media bucket AccessDenied

### Signals

- Incident media upload/download failures; Lambda logs `AccessDenied` / `AllAccessDisabled` on S3.
- Typical bucket pattern: `rapid-cortex-assets-<stage>-<accountId>` (prefix `incident-media/`); feature evidence/pre-plan buckets `rapid-cortex-evidence-<stage>`, `rapid-cortex-preplan-<stage>` (features stack).
- Presign URL failures in Incident Media / Public Incident Media HTTP Lambdas.

### Triage

1. Confirm **which principal** failed (Lambda role vs browser Cognito user via presign).
2. Check bucket **Block Public Access**, bucket policy, and KMS key policy if SSE-KMS.
3. Verify IAM on the media Lambda still includes `arn:aws:s3:::${AssetsBucket}/incident-media/*` (no empty Resource after `AWS::NoValue` mistakes — see IAM NoValue rule).
4. CloudTrail: `GetObject` / `PutObject` / `PutBucketPolicy` for the bucket in the incident window.

### Mitigate

- Restore least-privilege IAM from last known-good SAM template; avoid `*` on media objects in prod.
- If policy was tightened incorrectly, roll forward a corrected statement — do not open the bucket publicly.
- For corrupted/deleted objects: versioning may not be on by default — treat as data loss; use backups / re-upload from source device.

### Close

Upload/download smoke test for one agency incident media path; confirm no lingering AccessDenied in the last evaluation period.

---

## Escalation cheat sheet

| Situation | Escalate to |
| --- | --- |
| P0 / unclear blast radius | On-call via **PagerDuty**; page secondary if no ack |
| Suspected security breach | Security IR runbook + security on-call |
| Data restore / PITR | Change control + `scripts/soc2-restore-drill.sh` / `scripts/dr-test.sh` |
| Customer-facing outage messaging | Customer success / ops lead (per private contact matrix) |

After action: attach CloudWatch alarm name, request IDs, and timeline to the ticket. Keep PII and CAD content out of shared channels.
