# Backup and recovery

Rapid Cortex production data lives primarily in **DynamoDB** (incidents, transcripts, analyses, audit, agencies, invites, billing, language sessions) and **S3** (assets bucket). This document describes **what the SAM template enables**, how to **restore**, and **rollback** expectations. It is not a substitute for agency records-retention policy or legal hold procedures.

**Live production** is stack `rapid-cortex-dev` (`DeploymentStage=dev`, `https://app.rapidcortex.us`). That stage name is **not** a sandbox.

## DynamoDB point-in-time recovery (PITR)

As of **2026-09-17**, PITR is **ENABLED** on **182/182** Rapid Cortex/Ring tables in account `158961537080` ([SOC 2 evidence](../evidence/soc2-evidence/2026-10/README.md)).

SAM lock-in:

- `EnablePilotGradeBackups` includes `dev` on AppSam nested stacks (as well as staging/prod/pilot).
- `scripts/deploy.sh dev` forces `DDB_ENABLE_PITR=true` via `scripts/lib/soc2-live-production-overrides.sh`.
- Do **not** pass `DynamoPointInTimeRecovery=false` or rely on `auto` without that override — `auto` previously left AppSam PITR **off** while `DeploymentStage=dev`.

SOC 2 restore drill (new table only): [soc2/processes/restore-drill.md](../security-compliance/soc2/processes/restore-drill.md) and `scripts/soc2-restore-drill.sh`.

### Restore drill

1. Identify the **PITR restore window** (UTC) for the incident you are recovering from.
2. Prefer `DRY_RUN=1 bash scripts/soc2-restore-drill.sh <table>` then a ticketed restore to a **new** name.
3. Restore **each** table you need into names such as `rapid-cortex-audit-dev-restore-YYYYMMDD`.
4. **Validate** row counts, GSI queries, and a sample of incidents/transcripts against expectations.
5. **Swap** application traffic only under change control (update env / stack to point at restored tables, or copy items back into primary tables with a controlled job).

Never restore onto the production table name in place: prefer restore-to-new-table, validate, then cut over.

## S3 assets bucket

The stack creates `rapid-cortex-assets-<stage>-<account-id>` without versioning in the baseline template.

- **Pilot recommendation:** enable **versioning** and **lifecycle** rules in a follow-up change if you retain non-replaceable media (e.g. raw audio) for evidentiary workflows.
- **Deletion protection:** use bucket policies and IAM least-privilege; accidental deletes are not automatically reversible without versioning.

## Configuration and secrets backup

- **SAM / IaC:** Git tags and CI artifacts are the source of truth for template versions.
- **Secrets Manager:** rely on AWS backup policies for secret **metadata**; secret **values** must be recoverable from your **primary secret store** (password manager, HSM, or vendor) if deleted.
- **Cognito:** export user pool **identifiers** from stack outputs; user directory recovery follows AWS Cognito procedures (no PITR on the pool itself—plan exports or federation).

## Rollback (application)

See [`RUNBOOK.md`](./RUNBOOK.md) § Deploy and rollback. Short form:

1. **CloudFormation:** failed deploys may auto-rollback; successful bad deploys → redeploy previous artifact (`sam deploy` with known-good package or git tag).
2. **Web:** redeploy prior Next.js build; invalidate CDN if applicable.
3. **Data:** application rollback **does not** roll back DynamoDB writes; use PITR restore procedures for data-level rollback.

## Compliance dependencies

Formal **CJIS**, **HIPAA**, or **SOC 2 Type II** attestation is outside this runbook. Operating evidence for backup/restore lives in [soc2/](../security-compliance/soc2/README.md). Document who owns backup verification, restore testing cadence, and evidence retention. Do not claim contractual RTO/RPO unless Exhibit C is executed.
