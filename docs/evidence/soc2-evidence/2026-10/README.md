# SOC 2 observation-period evidence pack

**Collected:** 2026-09-17 (pre-October 1 baseline)  
**Account:** 158961537080  
**Production stack:** `rapid-cortex-dev` (`DeploymentStage=dev` — live `app.rapidcortex.us`)

Auditor role: `arn:aws:iam::158961537080:role/rc-soc2-auditor` (preferred) with fallback
`arn:aws:iam::158961537080:role/rapid-cortex-soc2-auditor`
(SecurityAudit + ReadOnlyAccess attached; extra reads inline).
Attach `infra/iam/sam-deploy-policy-soc2.prod.json` so the deploy user can create `rc-soc2-auditor`.

| Control | Status | Artifact |
|---|---|---|
| CloudTrail + log validation | **PASS** — `rapid-cortex-cloudtrail-prod`, `IsLogging=true`, `LogFileValidationEnabled=true`, multi-Region, S3 data events on all `rapid-cortex-*` buckets + all Lambda | `cloudtrail-status.json`, `cloudtrail-describe.json`, `cloudtrail-event-selectors.json` |
| S3 encryption + BPA | **PASS** (prior snapshot) | re-run `soc2-technical-controls-snapshot.sh` |
| DynamoDB PITR | **PASS** — 182/182 Rapid Cortex/Ring tables ENABLED | `dynamodb-pitr-post-fix.tsv` |
| KMS CMK rotation | **ACCEPT** — no customer-managed keys; AWS-managed `alias/aws/*` only (rotate by AWS) | snapshot KMS aliases |
| Secrets Manager rotation | **ACCEPT** — no auto-rotation; SOP below | `secrets-inventory.json`, `secrets-rotation-sop.md` |
| WAF logging | **PASS** on API CloudFront edge + web CDN. HTTP API is not a REST API — do not `associate-web-acl` on `restapis/` | `waf-logging-config.json` |
| CloudWatch / ACM expiry | **PASS** — `rc-acm-cert-expiry-cc0f7fc4` threshold 45 days, SNS OpsAlerts | `acm-expiry-alarm.json` |
| Cognito MFA | **PASS** — pool `us-east-1_0z6tA6WBs` `MfaConfiguration=ON` (Option A) | `cognito-mfa-config.json` |

## Root-cause override (do not rely on DeploymentStage=dev)

Do **not** rename stack `rapid-cortex-dev`. `scripts/deploy.sh dev` sources
`scripts/lib/soc2-live-production-overrides.sh`, which forces:

- `ENABLE_CLOUD_TRAIL=true` → `EnableCloudTrail=true`
- `DDB_ENABLE_PITR=true` → `DynamoPointInTimeRecovery=true`
- `ENABLE_API_WAF=true` → `EnableApiWaf=true`

Copy `scripts/env-api-dev.example.sh` into the gitignored `scripts/env-api-dev.sh`.
Templates: Cognito MFA hardcoded `ON`; DataLayer `EnablePilotGradeBackups` includes `dev`;
AppSam nests still need the explicit `DynamoPointInTimeRecovery=true` override.

PITR one-liner (if any new table is created without the param):

```bash
aws dynamodb list-tables --output text --query TableNames[] | tr '\t' '\n' \
  | grep -E '^(rapid-cortex-|RapidCortex|Ring)' \
  | while read -r t; do
      aws dynamodb update-continuous-backups --table-name "$t" \
        --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
    done
```

## Scope

Shared account carve-out: `Business Documents/Compliance/Rapid Cortex Compliance/01 - Governance/SYSTEM-BOUNDARY.md`

Re-run full snapshot:

```bash
AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 bash scripts/soc2-technical-controls-snapshot.sh
```
