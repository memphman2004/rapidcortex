# System boundary — Rapid Cortex (SOC 2)

**Policy owner:** Security lead (NEEDS OWNER)  
**TSC:** CC1.1, CC6.1, CC9.2  
**Status:** DRAFT pending management signature  
**Not a Type II report.**

This is the in-repo system-boundary description. A signed copy may also live in the private compliance share (`Business Documents/Compliance/Rapid Cortex Compliance/01 - Governance/SYSTEM-BOUNDARY.md`). If the two diverge, **update this file** so git matches what auditors are told.

---

## 1. In-scope system

| Item | Value |
|------|--------|
| System name | Rapid Cortex |
| Description | Cloud SaaS assistive intelligence for emergency communications (transcription, translation, AI summaries, supervisor QA, optional CAD-adjacent and product-vertical consoles). Does **not** replace CAD, 911 telephony, radio, or medical direction. |
| Legal entity | Apps on Demand LLC d/b/a Rapid Cortex (entity naming still open — LEG-007) |
| Production URL | `https://app.rapidcortex.us` |
| API | `https://api.rapidcortex.us` (and stack 2–4 API hosts as deployed) |
| CloudFormation stack | `rapid-cortex-dev` |
| DeploymentStage | `dev` (**live production**, not a sandbox) |
| AWS account | `158961537080` |
| Region | `us-east-1` (primary) |
| Identity | Amazon Cognito user pool `us-east-1_0z6tA6WBs` (`MfaConfiguration=ON` as of 2026-09-17) |
| Auditor IAM | `arn:aws:iam::158961537080:role/rapid-cortex-soc2-auditor` |

### In-scope components

- AWS: Lambda, API Gateway HTTP APIs, DynamoDB, S3 (Rapid Cortex buckets), Cognito, CloudWatch, SNS/SES (transactional), Secrets Manager, ACM, CloudFront, WAF (CloudFront-scope ACLs), ECS/Fargate (web SSR), Route 53 records for Rapid Cortex hosts, WAF logging groups named `aws-waf-logs-rapid-cortex-*`.
- Application: `apps/api`, `apps/web`, `apps/marketing` (public site is in scope for change control and TLS; not for incident PII).
- Desktop/mobile wrappers when they authenticate to the production Cognito pool.
- CloudTrail trail **`rapid-cortex-cloudtrail-prod`** (Option B — not the SAM resource `rapid-cortex-audit-dev`).
- Compliance buckets: `rapid-cortex-compliance-evidence-prod-158961537080`, `rapid-cortex-evidence-exports-prod-158961537080`.

### Trust zones

See [SECURITY_MODEL.md](../SECURITY_MODEL.md). Tenant isolation is `agencyId` on DynamoDB + `AuthorizationService` — never the URL slug.

---

## 2. Explicitly out of scope (Rapid Cortex SOC 2)

| Item | Reason |
|------|--------|
| Agency CAD, radio, CPE, 911 SIP | Customer-owned systems of record |
| Agency workstations, PSAP LAN, physical facilities | Customer environment |
| Other products in account `158961537080` (carve-out below) | Not Rapid Cortex |
| Engineering stack `rapid-cortex-staging` / `app-staging.rapidcortex.us` | Non-production; still change-controlled, not Type II production |
| CAD **write-back** to vendor systems | Fail-closed (`CAD_WRITEBACK_ENABLED` default false). Enable only with signed addendum. |
| Call Assist as a 911 console | Non-emergency / 311 only |
| External AI providers when secret ARNs are unset | Not processing production data |
| Personal devices used only for email/Slack | Covered by CC6 acceptable-use, not the CUEC for the SaaS |

---

## 3. Shared AWS account carve-out

Account `158961537080` also hosts **non–Rapid Cortex** workloads historically referred to as Melios, MindHeist, PassPoint, OR Game, and personal/marketing sites.

**SOC 2 treatment (chosen control):** Rapid Cortex production remains in this account for the October 2026 observation window. Other products are **out of Rapid Cortex system scope** under all of the following compensating controls:

1. **Naming:** Rapid Cortex resources use `rapid-cortex-*` / `RapidCortex*` / `Ring*` (Ring Connect module) names. PITR, S3 encryption/BPA, and CloudTrail data-event selectors are applied to those names.
2. **IAM:** Production deploy principal `rapid-cortex-deploy` and auditor role `rapid-cortex-soc2-auditor` are Rapid Cortex–named. Human access to Rapid Cortex data is reviewed quarterly ([processes/access-review.md](./processes/access-review.md)).
3. **Data:** Customer incident/transcript data lives in Rapid Cortex DynamoDB tables and Rapid Cortex S3 buckets only.
4. **Logging:** In-scope CloudTrail is `rapid-cortex-cloudtrail-prod` with S3 data events on `rapid-cortex-*` buckets.
5. **AccessDenied on other-product buckets** in the 2026-09-17 snapshot is expected and is **not** treated as a Rapid Cortex control failure.

**Residual risk (R-SOC-001):** a shared account means IAM or KMS mistakes can theoretically reach other products, and vice versa. Management accepts this for the first Type II window and tracks **dedicated-account migration** as a post-window improvement. If the CPA firm rejects the carve-out, production must move before the report is issued.

Do **not** expand Type II scope to Melios/MindHeist/etc. without a separate system description.

---

## 4. Complementary user entity controls (CUECs)

Agencies are responsible for:

- Granting and revoking their own Cognito users and `custom:role` values (agencyadmin / agencyit).
- MFA possession (TOTP devices) for their personnel.
- CAD/radio configuration and any CJIS personnel screening.
- Legal holds and records-retention calendars beyond product defaults.
- Reviewing Rapid Cortex audit events for their `agencyId`.
- Not placing production incident data in staging or demo tenants.

---

## 5. CloudTrail lock-in (Option B — do not create a second trail)

| Fact | Value |
|------|--------|
| Operating trail | `rapid-cortex-cloudtrail-prod` |
| `IsLogging` | `true` (2026-09-17 evidence) |
| `LogFileValidationEnabled` | `true` |
| Multi-Region | yes |
| Data events | `rapid-cortex-*` S3 + Lambda |
| SAM parameter on `rapid-cortex-dev` | `EnableCloudTrail=false` |

`infra/nested/stack-app-sam.yaml` names a SAM trail `${AppName}-audit-${DeploymentStage}` (`rapid-cortex-audit-dev`) and an S3 bucket `${AppName}-cloudtrail-logs-${DeploymentStage}-${AccountId}` with **Object Lock COMPLIANCE, 2555 days**. Turning `EnableCloudTrail=true` on the live stack would **create** that bucket and trail. COMPLIANCE lock cannot be shortened. That is not how live logging is implemented.

**Required:** leave `ENABLE_CLOUD_TRAIL=false` (or unset) for `deploy.sh dev`. `scripts/lib/soc2-live-production-overrides.sh` refuses `ENABLE_CLOUD_TRAIL=true` unless `SOC2_CREATE_SAM_CLOUDTRAIL=1` is set (emergency only, with a loud warning).

---

## 6. Other live controls vs SAM parameters

| Control | Live (2026-09-17 / 2026-10 pack) | SAM parameter risk | Lock-in |
|---------|----------------------------------|--------------------|---------|
| DynamoDB PITR | 182/182 Rapid Cortex/Ring **ENABLED** | `DynamoPointInTimeRecovery=auto` + `DeploymentStage=dev` would turn **AppSam** PITR off (data-layer already treats `dev` as pilot-grade) | Force `DDB_ENABLE_PITR=true`; add `dev` to `EnablePilotGradeBackups` on AppSam nests |
| Cognito MFA | Pool `us-east-1_0z6tA6WBs` **ON** | Template already hardcodes `MfaConfiguration: ON` | Keep hardcoded ON |
| WAF logging | CloudFront ACLs for API edge + web CDN | `EnableApiWaf` creates a **regional** ACL for inventory; HTTP API **cannot** associate WAFv2 | Do not associate WAF to HTTP API; CloudFront WAF stays via `deploy-api-edge.sh` |
| ACM expiry | Alarm `rc-acm-cert-expiry-cc0f7fc4` | Alarm created out-of-band | Keep; include in monthly observation pack |
| Secrets rotation | Manual SOP; 36 secrets, none auto-rotated | N/A | SOP + tickets are Type II evidence |
| KMS | AWS-managed aliases only | No CMK to rotate | ACCEPT with this boundary statement |
| CAD write-back | Fail-closed | Must not flip true on live | `deploy.sh` blocks `CAD_WRITEBACK_ENABLED=true` on `dev` |

---

## 7. Subprocessors

Canonical list: [SUBPROCESSOR_LIST.md](../SUBPROCESSOR_LIST.md). Review quarterly ([processes/vendor-management.md](./processes/vendor-management.md)).

---

## 8. Review

Re-approve this boundary when: AWS account changes, production hostname changes, a product vertical is sold under a different legal entity, or other-product workloads are added to account `158961537080`.
