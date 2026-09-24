# SOC 2 observation-period evidence pack

**Collected:** 2026-09-17 (pre-October 1 baseline)  
**Account:** 158961537080  
**Production stack:** `rapid-cortex-dev` (`DeploymentStage=dev` — live `app.rapidcortex.us`)

Auditor role: `arn:aws:iam::158961537080:role/rapid-cortex-soc2-auditor`  
(SecurityAudit + ReadOnlyAccess attached; extra reads inline. Deploy IAM cannot create `rc-soc2-auditor` — name must be `rapid-cortex-*`.)

| Control | Status | Artifact |
|---|---|---|
| CloudTrail + log validation | **PASS** — `rapid-cortex-cloudtrail-prod`, `IsLogging=true`, `LogFileValidationEnabled=true`, multi-Region, S3 data events on all `rapid-cortex-*` buckets + all Lambda | `cloudtrail-status.json`, `cloudtrail-describe.json`, `cloudtrail-event-selectors.json` |
| S3 encryption + BPA | **PASS** (prior snapshot) | re-run `soc2-technical-controls-snapshot.sh` |
| DynamoDB PITR | **PASS** — 182/182 NexCort iQ/Ring tables ENABLED | `dynamodb-pitr-post-fix.tsv` |
| KMS CMK rotation | **ACCEPT** — no customer-managed keys; AWS-managed `alias/aws/*` only (rotate by AWS) | snapshot KMS aliases |
| Secrets Manager rotation | **ACCEPT** — no auto-rotation; SOP below | `secrets-inventory.json`, `secrets-rotation-sop.md` |
| WAF logging | **PASS** on API CloudFront edge + web CDN. HTTP API is not a REST API — do not `associate-web-acl` on `restapis/` | `waf-logging-config.json` |
| CloudWatch / ACM expiry | **PASS** — `rc-acm-cert-expiry-cc0f7fc4` threshold 45 days, SNS OpsAlerts | `acm-expiry-alarm.json` |
| Cognito MFA | **PASS** — pool `us-east-1_0z6tA6WBs` `MfaConfiguration=ON` (Option A) | `cognito-mfa-config.json` |

## Root-cause override (do not rely on DeploymentStage=dev)

Live production is `DeploymentStage=dev`. Next SAM deploy (`scripts/deploy.sh dev`):

- **`DDB_ENABLE_PITR=true`** — forced by `scripts/lib/soc2-live-production-overrides.sh` so AppSam tables cannot lose PITR.
- **`ENABLE_CLOUD_TRAIL=false`** — keep SAM trail **off**. Operating control is Option B trail `rapid-cortex-cloudtrail-prod`. Setting true would CREATE `rapid-cortex-audit-dev` plus an Object Lock **COMPLIANCE** bucket (`rapid-cortex-cloudtrail-logs-dev-*`, 2555 days).
- **`CAD_WRITEBACK_ENABLED=false`** — rejected if true.
- `EnablePilotGradeBackups` includes `dev` on AppSam nests. Cognito MFA remains hardcoded `ON`.

Policy/process pack: [docs/security-compliance/soc2/README.md](../../../security-compliance/soc2/README.md).

## Scope

Shared account carve-out: `Business Documents/Compliance/NexCort iQ Compliance/01 - Governance/SYSTEM-BOUNDARY.md`

Re-run full snapshot:

```bash
AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 bash scripts/soc2-technical-controls-snapshot.sh
```
