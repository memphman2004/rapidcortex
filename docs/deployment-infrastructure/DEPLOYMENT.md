# Deployment — repeatable environments

This document is the **operator runbook** for shipping Rapid Cortex API + Cognito + data plane via SAM, then wiring the Next.js app. Pair with [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md), [AWS_SETUP.md](./AWS_SETUP.md), [INSTALLATION.md](./INSTALLATION.md), and [CI_RELEASE_PIPELINE.md](./CI_RELEASE_PIPELINE.md) (quality gates and ECS release order; no GitHub-specific workflows in-repo).

## Supported deployment stages

| `DeploymentStage` | Stack name convention | Typical use |
|-------------------|----------------------|-------------|
| `dev` | `rapid-cortex-dev` | Engineers; mock-friendly defaults in SAM mappings. |
| `staging` | `rapid-cortex-staging` | Pre-prod validation; Bedrock/AWS multilingual defaults. |
| `prod` | `rapid-cortex-prod` | Live multi-agency SaaS (when ready). |
| `pilot` | `rapid-cortex-pilot` | **Single controlled agency** production-like stack (same AI/multilingual defaults as `prod` in template). |

Each stage is a **separate CloudFormation stack**: its own **Cognito user pool**, **DynamoDB tables** (CloudFormation-generated physical names), **S3 assets bucket** (`rapid-cortex-assets-<stage>-<accountId>`), and **Cognito hosted UI domain prefix** (`rapidcortex-<stage>-<accountId>`).

## Prerequisites

- AWS CLI v2, SAM CLI, Node 22+, npm.
- IAM deploy permissions (see `infra/iam/sam-deploy-policy.json`).
- For **staging / prod / pilot**: real **`HTTP_API_CORS_ORIGINS`** (comma-separated `https://` origins, no spaces). The repository **`./scripts/deploy.sh`** refuses to deploy those stages without CORS set, unless `SKIP_CORS_CHECK=1`.

### Deploy IAM role/policy (optional but recommended)

If you want this repo to provision/update the deploy principal IAM resources:

```bash
export IAM_ROLE_NAME="rapid-cortex-sam-deploy-role"
export IAM_POLICY_NAME="rapid-cortex-sam-deploy-policy"
export AWS_REGION="us-east-1"
./scripts/deploy-iam.sh
```

Notes:
- `IAM_ROLE_NAME` + `IAM_POLICY_NAME` control IAM resource names (not SAM template params).
- Policy template is `infra/iam/sam-deploy-policy.json` and is rendered with account/region.
- Set `APP_NAME` to change `rapid-cortex-*` resource patterns in the generated policy.
- Set `IAM_ASSUME_PRINCIPAL_ARN` to restrict who can assume the role (defaults to account root).

## Standard deploy

From repo root:

```bash
chmod +x scripts/deploy.sh scripts/post-deploy-smoke.sh scripts/print-stack-outputs-for-web.sh
export HTTP_API_CORS_ORIGINS="https://www.rapidcortex.us"   # example; required for non-dev
./scripts/deploy.sh staging
```

With environment-style mapping:

```bash
export ENV_NAME="staging"
export IAM_ROLE_NAME="rapid-cortex-sam-deploy-role"
export IAM_POLICY_NAME="rapid-cortex-sam-deploy-policy"
export HTTP_API_CORS_ORIGINS="https://www.rapidcortex.us"
./scripts/deploy-from-env.sh
```

When both IAM vars are set, `deploy-from-env.sh` runs `deploy-iam.sh` before `sam deploy`.

Or use SAM profiles in [`samconfig.toml`](../samconfig.toml) (`dev`, `staging`, `prod`, `pilot`) with `sam deploy --config-env <profile>` — keep **parameter_overrides** in sync with `deploy.sh` (especially CORS).

## Build steps inside `deploy.sh`

1. `npm run build` (all workspaces).
2. `npm install --prefix infra/cognito-post-confirmation`.
3. `sam build --template-file infra/template.yaml`.
4. `sam deploy` with `DeploymentStage`, domain parameters, and `HttpApiCorsAllowedOrigins`.

## Post-deploy

```bash
./scripts/post-deploy-smoke.sh staging us-east-1
./scripts/print-stack-outputs-for-web.sh staging us-east-1
```

Copy the printed block into **`apps/web/.env.local`** (or Vercel/host env). Prefer:

- `NEXT_PUBLIC_AUTH_PROXY=1`
- `API_UPSTREAM_BASE=<HttpApiUrl or ApiCustomDomainUrl from outputs>`
- Cognito `NEXT_PUBLIC_*` values from the **same** stack.

## Static site on S3 + CloudFront (`rapidcortex.us` / `www`)

To host the marketing/app shell on **S3 + CloudFront** with **Route 53 A/AAAA** alias records, deploy the separate stack in **us-east-1** and sync built assets. See **[WEB_HOSTING_AWS.md](./WEB_HOSTING_AWS.md)** and `scripts/deploy-web-hosting.sh`.

## Custom domain + TLS (API)

Optional parameters on deploy (see `infra/template.yaml`):

- **`ApiDomainCertificateArn`** — ACM cert in the **same region** as the API.
- **`Route53HostedZoneId`** — leave `ApiDomainCertificateArn` empty to let the stack **request** an ACM cert and write DNS validation records.

Outputs: **`ApiCustomDomainUrl`**, **`ApiTlsCertificateArn`**.

## Secrets (production-safe)

- **Never** commit secrets. Lambdas read **Secrets Manager ARNs** and **`AWS::SecretsManager::Secret`** resources the template creates for managed multilingual mode.
- OpenAI / Anthropic keys: pass **`OpenAiApiKeySecretArn`** / **`AnthropicApiKeySecretArn`** parameters on deploy (see template).
- Web app: **`COGNITO_CLIENT_SECRET`** is only for app clients that use a secret (most public web clients use **no secret**). Server-side routes use env from the host only.

## Migrating from older templates (fixed resource names)

Earlier templates used **fixed DynamoDB table names** and a **shared Cognito domain prefix** per account. Current templates use **isolated names per stack**. Upgrading an in-place stack may **replace** DynamoDB or Cognito resources. Plan a **data export / import** or create a **new stack** (`rapid-cortex-pilot`) and cut over DNS + web env.

## Related

- [RUNBOOK.md](./RUNBOOK.md) — incidents and outages.
- [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) — governance + technical gates.
