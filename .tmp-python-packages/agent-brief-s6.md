# Section 6 — Operational Infrastructure

Repo: `/Volumes/Mac Mini/Coding Projects/Rapid Cortex`

## Conventions
- AWS names: `rapid-cortex-*` (never nexcortiq-*)
- Discover REAL DLQ queue names from infra SAM (search DeadLetter, DLQ, dlq)
- Reuse existing OpsAlerts / SNS topic if present
- Features SAM: `infra/nested/stack-app-sam-features.yaml`
- Never `AWS::NoValue` inside IAM Resource/Action arrays
- No emoji in SNS subjects/bodies

## 6.1 DLQ Review Worker
Create `apps/api/src/workers/dlq-review-worker.ts`:
- `checkDLQs` ScheduledHandler
- Loop DLQs from env `DLQ_QUEUE_NAMES` (comma-separated) with fallback list of real queues found in repo
- GetQueueUrl → ReceiveMessage (max 10) → CloudWatch PutMetricData namespace `RapidCortex/DLQ` metric `DLQMessageCount` dim QueueName → SNS to OPS_ALERTS_TOPIC_ARN when count > 0
- Truncate message bodies; no secrets/PII in logs
- Optional replay HTTP stub returning 501 is fine
- Register Lambda + Schedule rate(5 minutes) in features stack
- Explicit IAM for listed queue ARNs / GetQueueUrl; CW metrics; SNS publish
- Env: DeploymentStage/STAGE, OPS_ALERTS_TOPIC_ARN, DLQ_QUEUE_NAMES

## 6.2 Incident Response Runbook
Create `docs/runbooks/incident-response.md`:
- Severity P0–P3
- Four runbooks: Lambda errors, DDB throttles, Cognito failures, media bucket access denied
- Use rapid-cortex naming / real alarm patterns where known
- Cross-link `docs/operations-runbooks/INCIDENT_RESPONSE_RUNBOOK.md`
- Date: 2026-09-23
- No invented personal phone numbers — point to on-call / PagerDuty

## 6.3 DR Test Script
Create `scripts/dr-test.sh`:
- Arg STAGE (default staging)
- Check DynamoDB PITR on key tables via AWS CLI; CloudTrail logging status
- Soft delete/restore only if SAFE_DR_DESTRUCTIVE=1 (default off)
- Write `docs/dr-test-results/dr-test-${STAGE}-${TIMESTAMP}.md`
- mkdir -p; add README in that folder; gitignore generated reports if hygiene warrants
- Exit non-zero on critical failures when AWS reachable; graceful degrade when not

## Done criteria
- List files changed + gaps
- check-iam-novalue-resources.py if IAM touched
- Do not commit
