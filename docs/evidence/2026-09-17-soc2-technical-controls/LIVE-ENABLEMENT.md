# SOC 2 live control enablement — 2026-09-17T22:19Z

Account `158961537080` / `us-east-1` / `rapid-cortex-deploy`

## Done on the live account

| Control | Result |
|---|---|
| DynamoDB PITR | **141 newly ENABLED** + 41 already on = **182/182** Rapid Cortex/Ring tables. `agencies`, `incidents`, `audit` confirmed ENABLED. |
| Cognito MFA | Production pool `us-east-1_0z6tA6WBs` **`MfaConfiguration=ON`**, TOTP enabled. Next password login without TOTP is `MFA_SETUP` (web app already handles it). |
| API WAF logging | `rapid-cortex-httpapi-cdn-waf-dev` → `aws-waf-logs-rapid-cortex-httpapi-cdn-dev` |
| ACM expiry | Alarm `rapid-cortex-acm-expiry-api-rapidcortex-us` (DaysToExpiry < 30, state OK) |
| Evidence role | `arn:aws:iam::158961537080:role/rapid-cortex-soc2-evidence-readonly` (assume with MFA) |

## Still open — needs IAM policy apply + CloudTrail create

Attached deploy policy is **`rapid-cortex-sam-deploy-policy`** (not `rapid-cortex-deploy-policy`). Repo file `infra/iam/sam-deploy-policy.prod.json` now includes `cloudtrail:*`, `kms:*`, `secretsmanager:ListSecrets`, `acm:ListCertificates`.

Apply, then create the trail:

```bash
IAM_POLICY_NAME=rapid-cortex-sam-deploy-policy \
IAM_POLICY_WEB_NAME=rapid-cortex-sam-deploy-policy-web \
AWS_PROFILE=rapid-cortex bash scripts/apply-sam-deploy-managed-policies.sh

AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 bash scripts/soc2-enable-live-controls.sh
```

Until that apply lands, `GetTrailStatus` / `ListKeys` / `ListSecrets` remain AccessDenied.

## Shared account

Carve-out: `Business Documents/Compliance/Rapid Cortex Compliance/01 - Governance/SYSTEM-BOUNDARY.md`

## So the next SAM deploy does not revert live fixes

- Cognito `MfaConfiguration: ON` in `stack-app-sam.yaml`
- PITR `auto` includes `DeploymentStage=dev` in `stack-data-layer.yaml`
- `scripts/env-api-dev.sh`: `ENABLE_CLOUD_TRAIL=true`, `DDB_ENABLE_PITR=true`
- WAF logging resources in `infra/api-edge-cloudfront.yaml`
