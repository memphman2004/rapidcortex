# SOC 2 Type II — post-fix snapshot (2026-09-17T22:58Z)

Use **`docs/evidence/soc2-evidence/2026-10/`** as the auditor pack (named CLI artifacts). This directory is the full re-run of `scripts/soc2-technical-controls-snapshot.sh` after those fixes. The auto-generated table below this file in git history was wrong: it still looked for SAM trail name `rapid-cortex-audit-dev` and leftover OPTIONAL MFA copy.

**Account:** `158961537080` · **Principal:** `rapid-cortex-deploy` · **Region:** `us-east-1`

| Control | Target | This run |
|---|---|---|
| CloudTrail + log validation | PASS | **PASS** — trail `rapid-cortex-cloudtrail-prod` listed; dedicated artifacts show `IsLogging=true`, `LogFileValidationEnabled=true`. See `../2026-10/cloudtrail-status.json`. |
| S3 encryption + BPA | PASS | **PASS** for 19 `rapid-cortex-*` buckets (AES256 + BPA). Other-product buckets remain AccessDenied / out of Rapid Cortex scope. |
| DynamoDB PITR | PASS | **PASS** — 182/182 Rapid Cortex/Ring ENABLED (`../2026-10/dynamodb-pitr-post-fix.tsv`). |
| KMS CMK rotation | PASS or ACCEPT | **ACCEPT** — 7 keys, all AWS-managed (`alias/aws/*`). No CMKs to rotate. |
| Secrets Manager rotation | PASS or SOP | **ACCEPT** — 36 Rapid Cortex secrets, none auto-rotated. SOP: `../2026-10/secrets-rotation-sop.md`. |
| WAF logging | PASS | **PASS** on API edge + web CDN CloudFront ACLs. `CreatedByCloudFront-a0a27a88` has no logging (not an RC endpoint). Regional HTTP API ACL empty by design (CloudFront sits in front). |
| CloudWatch alarms | PASS | **PARTIAL→PASS for ACM** — `rc-acm-cert-expiry-cc0f7fc4` (45 days, SNS). Two INSUFFICIENT_DATA alarms remain (MEL billing, ALB 5xx). |
| Cognito MFA | PASS | **PASS** — `MfaConfiguration=ON` on `us-east-1_0z6tA6WBs`. |
| ACM expiry | PASS | **PASS** — alarm artifact `../2026-10/acm-expiry-alarm.json`. |

Auditor role: `arn:aws:iam::158961537080:role/rapid-cortex-soc2-auditor` (SecurityAudit + ReadOnlyAccess). Deploy IAM cannot create a role named `rc-soc2-auditor`.

Stack params still show `EnableCloudTrail=false` / `DynamoPointInTimeRecovery=auto` / `EnableApiWaf=false` until the next SAM deploy. Live CloudTrail is Option B (`rapid-cortex-cloudtrail-prod`) — **leave `EnableCloudTrail=false`** so SAM does not create a COMPLIANCE-locked second bucket. Next `deploy.sh dev` **must** keep `DDB_ENABLE_PITR=true` (forced by `scripts/lib/soc2-live-production-overrides.sh`) so CloudFormation does not turn AppSam PITR off.
