# SOC 2 Type II — Technical Controls Baseline

**Collected (UTC):** 2026-09-17T21:03:39Z–2026-09-17T21:08:01Z  
**Account:** `158961537080`  
**Principal:** `arn:aws:iam::158961537080:user/rapid-cortex-deploy` (`AWS_PROFILE=rapid-cortex`)  
**Region:** `us-east-1`  
**In-scope production stack:** `rapid-cortex-dev` (live production / `app.rapidcortex.us`)  
**Raw CLI artifacts:** `raw/20260917T210339Z-*`

This directory is the **control baseline** for the observation period. A Type II auditor will sample original CLI output. Any control that was not operating at period start is a gap for the whole period.

Re-run: `AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 bash scripts/soc2-technical-controls-snapshot.sh`

---

## Verdict

| Control | Auditor CLI | Operating in production? | Evidence |
|---|---|---|---|
| CloudTrail + log-file validation | **DENIED** (`GetTrailStatus`, `GetEventSelectors`, `DescribeTrails`) | **PARTIAL / not auditor-ready** | Management events *are* recording (`lookup-events` returned live KMS/STS calls). Stack param **`EnableCloudTrail=false`**. No `AWS::CloudTrail::Trail` on nested stacks. SAM bucket `rapid-cortex-cloudtrail-logs-dev-*` does **not** exist. Separate bucket `rapid-cortex-cloudtrail-logs-prod-158961537080` exists (SSE-S3, BPA, versioning). **Cannot prove** trail name, `IsLogging`, or `LogFileValidationEnabled`. S3/Lambda data events params are `false`. `CloudTrailKmsKeyArn` empty. |
| S3 default encryption + Block Public Access | OK on Rapid Cortex buckets | **PASS** for `rapid-cortex-*` (19/19) | All Rapid Cortex buckets: SSE-S3 `AES256` + all four BPA flags. Versioning missing on 5: `assets`, `resumes`, `sam-artifacts`, `translate-audio`, `vision-artifacts`. Other-product buckets in this account: **AccessDenied** (not proven missing). |
| DynamoDB PITR | OK | **GAP** — 41 of 182 Rapid Cortex/Ring tables | `DynamoPointInTimeRecovery=auto` and `DeploymentStage=dev`, so template condition `EnablePilotGradeBackups` is **false** (PITR auto-on only for staging/prod/pilot). Core tables **off**: `agencies`, `audit`, `analyses`, Ring session tables, billing, most incident/transcript tables. Newer feature tables **on**: Vision, Venue, CAD bridge, QR, Nest, Connect. Inventory: `dynamodb-pitr-inventory.tsv`. |
| KMS CMK rotation | **DENIED** (`ListKeys`) | **UNKNOWN** (no CMK aliases visible) | `kms:ListAliases` succeeded and returned **only AWS-managed** aliases (`alias/aws/s3`, `alias/aws/dynamodb`, `alias/aws/acm`, …). No customer-managed key aliases. AWS-managed keys rotate by AWS; that is **not** a CMK rotation control. |
| Secrets Manager rotation | **DENIED** (`ListSecrets`) | **UNKNOWN** | Two CFN secrets exist: `rapid-cortex/dev/billing/payment-instructions`, `rapid-cortex/dev/billing/ses-credentials`. Rotation flag not readable with this principal. No secret *values* collected. |
| WAF logging | OK (CloudFront list) | **GAP** | Regional WebACLs: **0**. Stack **`EnableApiWaf=false`**, `ApiWebAclArn=""`. CloudFront: logging **on** for `rapid-cortex-v2-web-cdn-prod` → log group `aws-waf-logs-rapid-cortex-v2-cdn-prod`. Logging **off** for `rapid-cortex-httpapi-cdn-waf-dev` and `CreatedByCloudFront-a0a27a88` (`WAFNonexistentItemException`). |
| CloudWatch alarms | OK | **PARTIAL** | 16 alarms: 14 `OK`, 0 `ALARM`, 2 `INSUFFICIENT_DATA` (`AWS-Billing-Alert-MEL`, `rapid-cortex-v2-alb-5xx-prod`). Coverage is CAD-bridge + live-video + ALB. **No ACM expiry alarm.** Several alarms have empty `AlarmActions`. |
| Cognito MFA | OK | **GAP** | Production pool `us-east-1_0z6tA6WBs`: **`MfaConfiguration=OPTIONAL`**. TOTP software token is *available*, not required. WebAuthn `SINGLE_FACTOR`. Password policy min length 12 + complexity. Staging pools `us-east-1_6i7Jq3Tzw` and `us-east-1_IoBei9vlD` also OPTIONAL. |
| ACM expiry monitoring | **DENIED** (`ListCertificates`) | **UNKNOWN** | Compensating: CFN `ApiManagedCertificate` = `arn:aws:acm:us-east-1:158961537080:certificate/cc0f7fc4-d4ca-4b1a-8ff6-e0676d872fa5`. CloudFront viewer-certificate inventory captured. No `DaysToExpiry` / ACM expiration alarm in CloudWatch. |

---

## Must-fix before observation period start

These are not documentation tasks. If they are still true on day 1 of the observation window, they stay findings for the whole Type II period.

1. **Auditor IAM role** — `rapid-cortex-deploy` cannot read CloudTrail trail status, KMS keys, Secrets Manager inventory, or ACM certificates. Create a read-only evidence role and re-run `scripts/soc2-technical-controls-snapshot.sh` so UNKNOWN rows become PASS/FAIL with native CLI output.

2. **CloudTrail** — Either turn **`EnableCloudTrail=true`** on `rapid-cortex-dev` (multi-Region, `EnableLogFileValidation=true`, `IsLogging=true`) **or** document the existing prod log bucket + the actual trail name, with `get-trail-status` and `get-event-selectors` output. Today you cannot show log-file validation. S3 object-level and Lambda data events are off.

3. **DynamoDB PITR** — Set **`DynamoPointInTimeRecovery=true`** (do not rely on `auto` while production is still `DeploymentStage=dev`) and enable PITR on every in-scope table, especially `agencies`, `audit`, incident/transcript tables, and Ring tables. 141 Rapid Cortex/Ring tables are currently `DISABLED`. One-liner:

```bash
aws dynamodb list-tables --output text --query TableNames[] | tr '\t' '\n' \
  | grep -E '^(rapid-cortex-|RapidCortex|Ring)' \
  | while read -r t; do
      aws dynamodb update-continuous-backups --table-name "$t" \
        --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
    done
```

4. **Cognito MFA** — Change production user pool MFA from `OPTIONAL` to **`ON`** (required), or document IdP-enforced MFA as the compensating control with evidence.

5. **WAF logging** — Enable logging on `rapid-cortex-httpapi-cdn-waf-dev`. Decide whether `EnableApiWaf=true` is required for API Gateway. Keep the existing CDN WAF log config.

6. **Secrets rotation** — After the auditor role can `DescribeSecret`, enable rotation (or a documented manual-rotation SOP with tickets) on every production secret.

7. **ACM expiry** — Add a CloudWatch alarm on `AWS/CertificateManager` `DaysToExpiry` (or EventBridge `ACM Certificate Approaching Expiration`) for every in-use cert, including `cc0f7fc4-d4ca-4b1a-8ff6-e0676d872fa5`.

8. **Account scope** — Account `158961537080` also hosts Melios, MindHeist, PassPoint, OR Game, and personal/marketing sites. For SOC 2, either move Rapid Cortex production to a **dedicated account** or treat those resources as in-scope (encryption, BPA, PITR, logging, access).

---

## What is already operating (keep)

- Rapid Cortex S3 buckets: default encryption + Block Public Access.
- CloudFront WAF on `rapid-cortex-v2-web-cdn-prod` with logging to CloudWatch Logs.
- 14 Rapid Cortex CloudWatch alarms in `OK`.
- Cognito password policy (12+ mixed character classes).
- CloudTrail *management-event delivery* is happening (some trail exists even though the SAM trail is not deployed).
- Compliance/evidence buckets already exist: `rapid-cortex-compliance-evidence-prod-158961537080`, `rapid-cortex-evidence-exports-prod-158961537080`.

---

## Artifact index

| File | Contents |
|---|---|
| `SNAPSHOT.json` | Collector metadata (profile, region, stamp) |
| `SUMMARY.json` | Machine-readable control extract |
| `dynamodb-pitr-inventory.tsv` | Every table + PITR status |
| `raw/20260917T210339Z-01-*` | CloudTrail CLI (mostly AccessDenied) + `lookup-events` sample |
| `raw/20260917T210339Z-02-*` | S3 list, encryption, BPA, versioning |
| `raw/20260917T210339Z-03-*` | DynamoDB list + `describe-continuous-backups` |
| `raw/20260917T210339Z-04-*` | KMS list-keys denied; list-aliases succeeded |
| `raw/20260917T210339Z-05-*` | Secrets list denied; CFN secret resource ARNs |
| `raw/20260917T210339Z-06-*` | WAF WebACLs + logging configuration |
| `raw/20260917T210339Z-07-*` | CloudWatch alarms OK / ALARM / INSUFFICIENT_DATA |
| `raw/20260917T210339Z-08-*` | Cognito user pools + MFA config |
| `raw/20260917T210339Z-09-*` | ACM list denied; CloudFront certificate inventory |
| `raw/20260917T210339Z-10-*` | CloudFormation parameters and security resources |

Do not delete `raw/`. Auditors sample original CLI JSON, not this summary.
