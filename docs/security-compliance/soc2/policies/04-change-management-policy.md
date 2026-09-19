# POL-04 Change management policy

| Field | Value |
|-------|--------|
| Policy ID | POL-04 |
| TSC | CC8.1, CC5.1 |
| Owner | Jeff Coleman (interim engineering lead) |
| Approver | Management |
| Effective | DRAFT 2026-09-19 |
| Review | Annual |

**Not a Type II report.**

## 1. Standard change path

1. Branch from the agreed base (`main` for production-bound work).
2. Pull request with description, risk, and rollback.
3. Required checks: typecheck/tests as applicable; `sam validate --lint` for SAM edits; `scripts/infra-template-size-check.sh` after template changes; `python3 scripts/check-iam-novalue-resources.py` when IAM statements change.
4. At least one reviewer who is not the author. Infra (`infra/**`, IAM, Cognito, WAF, CloudTrail) needs security-aware review.
5. Merge to `main`.
6. Deploy:
   - Engineering: `source scripts/env-api-staging.sh && bash scripts/deploy.sh staging`
   - **Live production:** `source scripts/env-api-dev.sh && bash scripts/deploy.sh dev` (`I_UNDERSTAND_DEV_IS_PROD=1`). Stack name stays `rapid-cortex-dev`.

Emergency (SEV-1) changes may skip staging **with a ticket**, post-review within 2 business days.

## 2. Forbidden without go/no-go

- `CAD_WRITEBACK_ENABLED=true` on live (`DeploymentStage=dev` or `prod`).
- Renaming live stack `rapid-cortex-dev`.
- `EnableCloudTrail=true` on live (would create Object Lock COMPLIANCE bucket + second trail). See [SYSTEM-BOUNDARY.md](../SYSTEM-BOUNDARY.md).
- `DynamoPointInTimeRecovery=false` or `auto` on live — override library forces `true`.
- Wildcard IAM `Resource: []` via `AWS::NoValue` inside lists.

## 3. Feature flags

Operational flags default **ON** when unset, except CAD write-back (fail-closed). Document new flags in `.env.example` and tests.

## 4. Evidence

Every production deploy is a row in [change-log.md](../evidence/change-log.md): date (UTC), git SHA, ticket, deployer role, result, rollback if any. Git history is the system of record; the log is the auditor sample sheet.

Procedure: [change-management.md](../processes/change-management.md).
