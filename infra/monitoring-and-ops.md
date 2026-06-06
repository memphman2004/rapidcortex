# Monitoring and operations (infra pointer)

**Canonical pilot documentation:** [`docs/operations-runbooks/MONITORING_AND_OPS.md`](../docs/operations-runbooks/MONITORING_AND_OPS.md) — dashboards, alarms, SNS topic, synthetic checks, “where to look,” and **hosted web login / ECS CloudWatch** guidance.

**Backup / PITR:** [`docs/BACKUP_AND_RECOVERY.md`](../docs/BACKUP_AND_RECOVERY.md)

**Runbook:** [`docs/RUNBOOK.md`](../docs/RUNBOOK.md)

The SAM template [`template.yaml`](./template.yaml) defines:

- `PilotOperationsDashboard` — CloudWatch dashboard (name output `PilotOperationsDashboardName`)
- `OpsAlertsTopic` — SNS for alarm notifications (output `OpsAlertsTopicArn`)
- Alarms for API 5xx, integration latency p95, Lambda errors/throttles/duration, DynamoDB user errors, and voice pipeline log metrics
- Explicit log group + metric filter on the multilingual **audio chunk** Lambda
