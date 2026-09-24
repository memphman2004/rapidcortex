# POL-08 Business continuity and disaster recovery

| Field | Value |
|-------|--------|
| Policy ID | POL-08 |
| TSC | CC7.5, CC9.2 |
| Owner | Jeff Coleman (interim engineering lead) |
| Approver | Management |
| Effective | DRAFT 2026-09-19 |
| Review | Annual |

**Not a Type II report.** RTO/RPO numbers are **not** contractual unless Exhibit C SLA is executed.

## 1. Recovery objectives (internal targets, not SLA)

| Item | Internal target |
|------|-----------------|
| RPO (DynamoDB) | PITR (seconds) on in-scope NexCort iQ/Ring tables |
| RTO (regional AWS degradation) | Redeploy / failover per AWS status; no second-region active-active claimed |
| RTO (bad application deploy) | Redeploy previous git tag / SAM artifact |
| Data restore | Restore **to a new table**, validate, cut over only under change control |

Live production PITR: **182/182 ENABLED** as of 2026-09-17. `DeploymentStage=dev` is live; do not treat it as a cheap dev stack. See [BACKUP_AND_RECOVERY.md](../../../operations-runbooks/BACKUP_AND_RECOVERY.md).

## 2. Backups

- **DynamoDB:** PITR required on NexCort iQ and Ring tables. Next live SAM deploy must pass `DynamoPointInTimeRecovery=true` (forced by `soc2-live-production-overrides.sh`).
- **S3:** default encryption + Block Public Access on NexCort iQ buckets. Versioning is required on evidence and CloudTrail buckets; enable versioning on remaining asset buckets as a tracked improvement.
- **Secrets:** metadata in AWS; **values** recoverable from the operator’s primary secret store if deleted.
- **Cognito:** no PITR on the user pool; export identifiers from stack outputs; plan federation/export.

## 3. Restore drill

Before the observation window and at least annually: [restore-drill.md](../processes/restore-drill.md). Default is **dry-run**. Live restore always targets a **new** table name. Never overwrite production tables in place.

## 4. Dependencies

Floor operations continue on CAD/radio if NexCort iQ is down. Communicate “assistive layer unavailable — use CAD” — never imply 911 is down because NexCort iQ is down.
