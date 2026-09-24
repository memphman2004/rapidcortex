# Section 5 — Security & Compliance

Repo: `/Volumes/Mac Mini/Coding Projects/Rapid Cortex`

## Conventions
- AWS names: `rapid-cortex-*` (never nexcortiq-*)
- Stage param: `DeploymentStage`
- Features SAM: `infra/nested/stack-app-sam-features.yaml`
- Parent: `infra/template.yaml`
- Deploy: `scripts/deploy.sh` — wire ParameterOverrides there (no deploy2.sh)
- Roles: `agencyadmin`, `rcsuperadmin`, `rcadmin` (not AGENCY_ADMIN)
- Never put `AWS::NoValue` inside IAM Resource/Action lists — hoist `!If` to Statement. Run `python3 scripts/check-iam-novalue-resources.py` after IAM edits.

## 5.1 Customer-Managed KMS
In `stack-app-sam-features.yaml`:
1. Parameter `AgencyKMSKeyArn` (String, Default "")
2. Condition `UseCustomKMS: !Not [!Equals [!Ref AgencyKMSKeyArn, ""]]`
3. Every DynamoDB table SSESpecification:
```yaml
SSESpecification:
  SSEEnabled: true
  SSEType: !If [UseCustomKMS, "KMS", "AES256"]
  KMSMasterKeyId: !If [UseCustomKMS, !Ref AgencyKMSKeyArn, !Ref AWS::NoValue]
```
4. Every S3 bucket encryption: when custom KMS, use aws:kms + KMSMasterKeyId; when not, AES256 without KMSMasterKeyId.
5. Pass param from parent template Features nested stack (default "").
6. In deploy.sh, if `AGENCY_KMS_KEY_ARN` set, pass override. Match existing override patterns.

## 5.2 SSO/SAML
Create `apps/api/src/handlers/agency-sso.ts`:
- Cognito Create/Update/Delete/Describe IdentityProvider (SAML)
- ProviderName: `SAML-${agencyId}`
- RBAC: agencyadmin / rcsuperadmin / rcadmin via existing helpers (`normalizeSessionRole`, AuthorizationService, getUserContext)
- Search first for existing SSO/Cognito IdP handlers and mirror
- Store ssoEnabled + samlProviderName on agency record if possible
- Register HTTP route under FeaturesHttp catch-all OR agency-admin stack — whichever fits
- Audit on configure/delete
- Env: COGNITO_USER_POOL_ID

## 5.3 SIEM (gated, default off)
In features stack (if size OK; else note gap):
- Params: SIEMEnabled default "false", SIEMEndpointUrl default ""
- Condition SIEMActive
- Firehose HTTP endpoint + S3 backup bucket `rapid-cortex-siem-backup-${DeploymentStage}-${AWS::AccountId}`
- Explicit IAM (no Resource *)
- Optional Log subscription to FeaturesHttpFunction log group only if safe
- deploy.sh: SIEM_ENABLED=true passes overrides

## 5.4 CloudTrail
Already in stack-app-sam-5 with EnableCloudTrail Default "true". Verify ~7 year retention on CloudTrail/audit bucket lifecycle. Extend if shorter. Do not recreate trail.

## Done criteria
- Files changed listed
- sam validate if available
- check-iam-novalue-resources.py if IAM touched
- Do not commit
