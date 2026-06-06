# Backup and recovery (pilot)

Rapid Cortex pilot data lives primarily in **DynamoDB** (incidents, transcripts, analyses, audit, agencies, invites, billing, language sessions) and **S3** (assets bucket). This document describes **what the SAM template enables**, how to **restore**, and **rollback** expectations. It is not a substitute for agency records-retention policy or legal hold procedures.

## DynamoDB point-in-time recovery (PITR)

For `DeploymentStage` **staging**, **prod**, or **pilot**, all application DynamoDB tables in [`infra/template.yaml`](../infra/template.yaml) set:

- `PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled: true`

**Dev** stacks leave PITR **disabled** to reduce cost; do not store production-like data in dev without enabling PITR manually.

### Restore drill (recommended before pilot go-live)

1. Identify the **PITR restore window** (UTC) for the incident you are recovering from.
2. In DynamoDB console, **Backups → Restore to new table** (or AWS CLI `restore-table-to-point-in-time`).
3. Restore **each** table you need into names such as `IncidentsTable-restore-YYYYMMDD`.
4. **Validate** row counts, GSI queries, and a sample of incidents/transcripts against expectations.
5. **Swap** application traffic only under change control (update env / stack to point at restored tables, or copy items back into primary tables with a controlled job).

Never rename production tables in place without a runbook: prefer restore-to-new-table, validate, then cut over.

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

Formal **CJIS**, **HIPAA**, or **SOC 2** alignment requires agency- and account-level controls beyond this repository. Document who owns backup verification, restore testing cadence, and evidence retention.
