# SOC 2 Type II — Technical Controls Verdict

**Collected (UTC):** 2026-09-17T23:02:23Z
**Account:** `158961537080`
**Principal:** `arn:aws:iam::158961537080:user/rapid-cortex-deploy`
**Region:** `us-east-1`
**In-scope production stack:** `rapid-cortex-dev (live production / app.rapidcortex.us)`

Observation-period rule: every in-scope row must be **PASS** or **ACCEPT** before October 1.

## Verdict by control

| Control | Status | Notes |
|---|---|---|
| CloudTrail + log-file validation | **PASS** | describe-trails `rapid-cortex-cloudtrail-prod` LogFileValidationEnabled=True multi-Region=True. get-trail-status `rapid-cortex-cloudtrail-prod` IsLogging=true. `rapid-cortex-cloudtrail-prod` is listed in CloudTrail. lookup-events returned recent management events. S3 log bucket `rapid-cortex-cloudtrail-logs-prod-158961537080` exists. Stack param EnableCloudTrail=false (Option B = existing trail outside SAM). |
| S3 encryption + Block Public Access | **PASS** | 19 rapid-cortex-* buckets; encryption=AES256. Other-product buckets in this shared account are carved out of Rapid Cortex SOC 2 scope (SYSTEM-BOUNDARY.md). |
| DynamoDB PITR | **PASS** | 182/182 Rapid Cortex/Ring tables ENABLED. Param DynamoPointInTimeRecovery=auto. |
| KMS CMK rotation | **ACCEPT** | No customer-managed keys in scope. AWS-managed alias/aws/* keys rotate by AWS (not a CMK control). |
| Secrets Manager rotation | **ACCEPT** | Auto-rotation is not enabled on Rapid Cortex secrets. Compensating SOP: `docs/evidence/soc2-evidence/2026-10/secrets-rotation-sop.md`. |
| WAF logging | **PASS** | Regional ACLs: 0. CloudFront ACLs: 3. EnableApiWaf=false. HTTP API is fronted by CloudFront-scope WAF (not REST association). Out-of-scope CloudFront default ACL logging gaps ignored: CreatedByCloudFront-a0a27a88. |
| CloudWatch / ACM expiry | **PASS** | 18 alarms (16 OK, 0 ALARM, 2 INSUFFICIENT_DATA). ACM DaysToExpiry alarm `rc-acm-cert-expiry-cc0f7fc4` is present. Unrelated INSUFFICIENT_DATA alarms (MEL billing / ALB) are out of Rapid Cortex ACM scope. |
| Cognito MFA | **PASS** | Production pool `us-east-1_0z6tA6WBs` MfaConfiguration=`ON`. Password min length=12. |
| ACM expiry monitoring | **PASS** | CloudWatch alarm on AWS/CertificateManager DaysToExpiry for cert cc0f7fc4-d4ca-4b1a-8ff6-e0676d872fa5 (threshold 45 days). |

**Overall:** `PASS`

Stack params on this collector run still showed `EnableCloudTrail=false` / `DynamoPointInTimeRecovery=auto` / `EnableApiWaf=false`. Live controls were already on (Option B trail, PITR CLI, CloudFront WAF, MFA ON, ACM alarm). The next `deploy.sh dev` sources `scripts/lib/soc2-live-production-overrides.sh` so those three parameters are passed as **true** without renaming `rapid-cortex-dev`.

## How to re-run

```bash
AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 bash scripts/soc2-technical-controls-snapshot.sh
```

Retain `raw/`. Auditors sample original CLI JSON, not this summary.
