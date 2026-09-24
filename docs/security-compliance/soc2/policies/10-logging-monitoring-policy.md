# POL-10 Logging and monitoring policy

| Field | Value |
|-------|--------|
| Policy ID | POL-10 |
| TSC | CC4.1, CC7.1, CC7.2 |
| Owner | Jeff Coleman (interim engineering lead) |
| Approver | Management |
| Effective | DRAFT 2026-09-19 |
| Review | Annual |

**Not a Type II report.**

## 1. What is logged

| Source | Purpose | PII rule |
|--------|---------|----------|
| CloudTrail `rapid-cortex-cloudtrail-prod` | AWS API / data events for NexCort iQ buckets + Lambda | Management events; no secret values |
| CloudWatch Logs | Lambda / ECS application logs | No raw transcripts, JWTs, passwords |
| DynamoDB audit table | Application mutations | Agency-scoped; see [AUDIT_EVENT_MATRIX.md](../../AUDIT_EVENT_MATRIX.md) |
| WAF logs | Edge deny/count | IP + rule IDs |
| ACM alarm `rc-acm-cert-expiry-cc0f7fc4` | Cert expiry 45 days | N/A |

## 2. Alerting

CloudWatch alarms → SNS OpsAlerts topic. **Paging** (phone/Slack/PagerDuty) is PLT-025 — document the roster off-git. Two historical `INSUFFICIENT_DATA` alarms (MEL billing, ALB 5xx) are tracked; they are not NexCort iQ customer-data controls.

## 3. Review

Monthly: [monthly-control-check.md](../evidence/monthly-control-check.md) and `scripts/soc2-observation-pack.sh`. Confirm `IsLogging=true`, PITR ENABLED on sample tables, Cognito MFA ON, WAF logging present.

## 4. Clock / integrity

CloudTrail log-file validation is **enabled** on the production trail. Do not disable it.
