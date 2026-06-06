# Infrastructure

AWS resources for Rapid Cortex (API Gateway, Lambda, DynamoDB, Cognito, S3, CloudWatch, Route53 records) are defined in **`infra/template.yaml`**. Operator checklist and scripts: **[`docs/AWS_SETUP.md`](../docs/AWS_SETUP.md)**. **CloudWatch dashboard** (`PilotOperationsDashboard`), **SNS ops topic** (`OpsAlertsTopic` — outputs `PilotOperationsDashboardName` / `OpsAlertsTopicArn`), **alarms**, and **DynamoDB PITR** (staging / prod / pilot) are documented in **[`docs/MONITORING_AND_OPS.md`](../docs/MONITORING_AND_OPS.md)** and **[`docs/BACKUP_AND_RECOVERY.md`](../docs/BACKUP_AND_RECOVERY.md)**.

### Cognito self sign-up

The template enables **self-service user registration** (`AdminCreateUserConfig`) and a **PostConfirmation** Lambda that seeds **`custom:agencyId`** / **`custom:role`** so new users can obtain valid JWTs. Parameters **`SelfSignupDefaultAgencyId`** and **`SelfSignupDefaultRole`** default to a placeholder agency and `dispatcher`. Run **`npm install --prefix infra/cognito-post-confirmation`** before **`sam build`** (the deploy script does this). Full checklist: **[`docs/COGNITO_SELF_SIGNUP.md`](../docs/COGNITO_SELF_SIGNUP.md)**.

### Staging / production defaults (AI, multilingual, CORS)

- **`Mappings.ApiLambdaDefaults`** drives **Globals** so **`dev`** keeps mock providers, while **`staging`**, **`prod`**, and **`pilot`** use **Amazon Bedrock** for analysis and **AWS** (Comprehend / Transcribe / Translate) as the primary multilingual tiers (see **`docs/DEPLOYMENT_MULTILINGUAL_AWS.md`**). Analysis Lambdas need **Bedrock IAM** (already on `AnalyzeIncidentFunction`); voice Lambdas need **Transcribe / Translate / Comprehend** where wired.
- **`HttpApiCorsAllowedOrigins`** (parameter, default `*`) is split on commas into the HttpApi **CORS** allow list. For **non-dev** deploys, **`./scripts/deploy.sh`** requires **`HTTP_API_CORS_ORIGINS`** (or `SKIP_CORS_CHECK=1`). See **`docs/DEPLOYMENT.md`**.
- To run **staging**/**prod** SAM stages with an all-mock AI chain (rare sandboxes), set Lambda env **`AI_ALLOW_MOCK_ONLY_IN_PROD=true`** so analysis does not fail the new fail-fast check.

Every Lambda under `apps/api/src/handlers/` has a matching **HTTP API** route in that template (path + method + auth). The web app’s typed client lives in `apps/web/lib/api.ts` (plus the cookie-auth proxy at `apps/web/app/api/backend/[[...path]]/route.ts`). The template enables **CORS** on the HttpApi (`AllowOrigins: *` today); tighten `AllowOrigins` for production once app and API origins are fixed.

## Domain topology

Recommended public topology for U.S. municipal buyers:

- `rapidcortex.us` — apex marketing (optional)
- `www.rapidcortex.us` — **primary web app host**; product routes live under **`https://www.rapidcortex.us/<city-town-or-county-name>/…`** (URL slug for the city, town, or county, e.g. **`https://www.rapidcortex.us/columbus/dashboard`**)
- `api.rapidcortex.us` — backend API custom domain
- `app.rapidcortex.us` — optional alternate app host if you split marketing from app later
- `admin.rapidcortex.us` — optional dedicated admin host (not required if admins use the same `www` URLs with an admin role)

The template now supports this with parameters:

- `RootDomainName` (default `rapidcortex.us`)
- `ApiSubdomainPrefix` (default `api`)
- `ApiDomainCertificateArn` (optional; imported ACM ARN in the **same region** as the stack for regional API Gateway TLS)
- `Route53HostedZoneId` (optional; when set and `ApiDomainCertificateArn` is empty, the stack **requests an ACM certificate** for `api.<root>` and creates DNS validation records in that zone—`sam deploy` waits until the cert is **ISSUED**)
- optional CNAME targets for `app`, `admin`, `www`
- optional **multilingual voice** parameters: `AzureSpeechKeySecretArn`, `AzureTranslationKeySecretArn`, `GoogleApplicationCredentialsSecretArn`, `MultilingualSecretProvisioning` (`external`|`managed`), `MultilingualSecretsPolicyMode` (`scoped`|`broad`); see **`docs/DEPLOYMENT_MULTILINGUAL_AWS.md`**

### TLS / certificates

- **Regional HTTP API** (`AWS::ApiGatewayV2::DomainName` with `EndpointType: REGIONAL`) must use an **ACM certificate in the same AWS region** as the API (for example `us-east-1` if the stack is in `us-east-1`).
- **CloudFront** (for `app` / marketing) uses certificates in **`us-east-1` only**. Do not reuse the same ACM ARN across regions; request or import the right cert per distribution and per API region.
- **Apex + `www` on S3 + CloudFront:** use the separate stack **`infra/web-hosting-template.yaml`** (deploy with **`scripts/deploy-web-hosting.sh`** in **`us-east-1`**). It creates S3, CloudFront (OAC), ACM for apex/`www`, and Route 53 **A/AAAA alias** records. See **`docs/WEB_HOSTING_AWS.md`**. Avoid also setting **`WwwCnameTarget`** on the API stack for the same hostname (CNAME conflicts with alias records).
- **Two ways to wire the API cert:** pass `API_DOMAIN_CERT_ARN`, **or** set `ROUTE53_HOSTED_ZONE_ID` only and let CloudFormation manage ACM + validation (same region as deploy).

### Deploy IAM

Runtime access for Lambdas is defined in the SAM template: **per-function** DynamoDB (and Cognito where needed) plus **`S3CrudPolicy` on `AssetsBucket` for every API Lambda**, matching the required `ASSETS_BUCKET` env var from `apps/api/src/lib/env.ts`. For **humans or CI** running `sam deploy`, use a dedicated IAM user or role with a narrow policy. Edit placeholders in [`infra/iam/sam-deploy-policy.json`](iam/sam-deploy-policy.json) (`REPLACE_ACCOUNT_ID`, `REPLACE_REGION`, `REPLACE_HOSTED_ZONE_ID`), attach it to the deploy principal. For OIDC-based CI (no long-lived keys), add an IAM OIDC identity provider and trust policy for **your** IdP in AWS IAM or your org’s IaC—this repo does not ship forge-specific trust JSON.

For reproducible artifact buckets (tighter S3 IAM), create a bucket (for example `rapid-cortex-sam-artifacts-prod`) and pass `sam deploy --s3-bucket ...` instead of only `--resolve-s3`.

## Principles

- **Separate** dev / staging / prod accounts or resource namespaces where possible.
- **No secrets** in templates—use AWS Secrets Manager or SSM Parameter Store references.
- **GovCloud** migration is a future track; document deltas when you add region-specific resources.

## Deploy

- Stage deploy script:
  - `./scripts/deploy.sh dev`
  - `./scripts/deploy.sh staging`
  - `./scripts/deploy.sh prod`
- Optional env vars for domain wiring:
  - `API_DOMAIN_CERT_ARN`
  - `ROUTE53_HOSTED_ZONE_ID` (managed ACM for `api.<root>` when no cert ARN is set)
  - `APP_CNAME_TARGET`
  - `ADMIN_CNAME_TARGET`
  - `WWW_CNAME_TARGET`

Example:

```bash
API_DOMAIN_CERT_ARN="arn:aws:acm:us-east-1:123456789012:certificate/xxxx" \
APP_CNAME_TARGET="d111111abcdef8.cloudfront.net" \
WWW_CNAME_TARGET="d222222abcdef8.cloudfront.net" \
./scripts/deploy.sh prod
```

Managed ACM (no pre-created cert ARN; same region as stack):

```bash
ROUTE53_HOSTED_ZONE_ID="Z1234567890ABC" \
./scripts/deploy.sh prod
```

## Post-deploy smoke check

Run the backend smoke checks after deployment:

```bash
./scripts/post-deploy-smoke.sh prod us-east-1
```

This validates:

- CloudFormation outputs for API/Cognito
- `GET /api/health` returns 200
- `GET /api/me` returns 401 when unauthenticated
- Same checks on `ApiCustomDomainUrl` when configured

## AI analysis Lambdas

`AnalyzeIncidentFunction` and `AddTranscriptChunkFunction` run the multi-provider orchestrator (`apps/api/src/ai/`). The SAM template sets **120s timeout**, **Secrets Manager `GetSecretValue`** (account-scoped `secret:*` today — tighten ARNs per secret in hardened accounts), **Amazon Bedrock `Converse` / `InvokeModel`**, optional **`OpenAiApiKeySecretArn` / `AnthropicApiKeySecretArn` parameters**, and **CloudWatch alarms** on Lambda errors and duration p95. Operational detail: [AI provider configuration](../docs/AI_PROVIDER_CONFIGURATION.md) and [AI runbook](../docs/RUNBOOK_AI_ANALYSIS.md).

## Multilingual voice

`LanguageSessionsTable` plus four HTTP routes (`/api/incidents/{id}/language-session/start|finalize|status`, `/api/incidents/{id}/audio-chunks`) are defined in `template.yaml`. See [Multilingual call pipeline](../docs/MULTILINGUAL_CALL_PIPELINE.md) and [Language / translation configuration](../docs/LANGUAGE_TRANSLATION_CONFIGURATION.md).

## Next steps

- Centralize env documentation with root [`.env.example`](../.env.example).
- Add CI job to validate SAM template on every PR touching `infra/template.yaml`.
