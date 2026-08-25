# Environment matrix — stacks vs app configuration

Use this table to keep **AWS stacks**, **Next.js public env**, and **BFF proxy** aligned. One row = one consistent environment (no cross-pool tokens, no cross-stack API URLs).

**Long-form reference:** [ENVIRONMENT_CONFIGURATION_REFERENCE.md](./ENVIRONMENT_CONFIGURATION_REFERENCE.md) · **Flags:** [FEATURE_FLAGS.md](./FEATURE_FLAGS.md).

## Operational mapping (account 158961537080)

CloudFormation `DeploymentStage` names do **not** match how we operate the product:

| Operator name | `DeploymentStage` | Stack | Public web | Purpose |
|---------------|-------------------|-------|------------|---------|
| **Live / production** | `dev` | `rapid-cortex-dev` | `https://app.rapidcortex.us` | Customer-facing. Source `scripts/env-api-dev.sh` (`I_UNDERSTAND_DEV_IS_PROD=1`). |
| **Engineering** | `staging` | `rapid-cortex-staging` | `https://app-staging.rapidcortex.us` | Day-to-day development. Source `scripts/env-api-staging.sh`. Isolated Dynamo (including Rapid IQ / campus / venue / RCS orphans). |
| **Unused CFN name** | `prod` | `rapid-cortex-prod` | — | Reserved SAM stage; **not** the live host. |
| **Pilot** | `pilot` | `rapid-cortex-pilot` | agency-specific | Controlled single-agency stack when used. |

Never point staging Lambdas at `*-dev` Dynamo tables or `app.rapidcortex.us` / `api.rapidcortex.us` DNS. Staging API deploys must set `MANAGE_API_DOMAIN_DNS=false` and must not pass a Route53 zone or ACM cert (those belong to web SSR for `app-staging` only).

CAD write-back stays **fail-closed** on every stage until a signed addendum.

| Concern | staging (engineering) | dev (live) | prod (unused name) | pilot |
|--------|------------------------|------------|--------------------|-------|
| **SAM stack** | `rapid-cortex-staging` | `rapid-cortex-dev` | `rapid-cortex-prod` | `rapid-cortex-pilot` |
| **`DeploymentStage` param** | `staging` | `dev` | `prod` | `pilot` |
| **Cognito user pool** | Stack-owned; prefix `rapidcortex-stg-<accountId>` | `rapidcortex-dev-<accountId>` | same pattern | same pattern |
| **DynamoDB tables** | `rapid-cortex-*-staging` (orphans cloned empty from `-dev` schema) | `rapid-cortex-*-dev` | `*-prod` | `*-pilot` |
| **S3 assets bucket** | `rapid-cortex-assets-staging-<accountId>` | `rapid-cortex-assets-dev-<accountId>` | …-prod-… | …-pilot-… |
| **API custom domain** | execute-api only (no `api.rapidcortex.us`) | `https://api.rapidcortex.us` | unused | unused |
| **Web SSR host** | `app-staging.rapidcortex.us` | `app.rapidcortex.us` | — | — |
| **API default AI / multilingual** | Bedrock + AWS tiers (template mappings) | Live providers (see `env-api-dev.sh`) | Bedrock + AWS tiers | Same as **prod** in mappings |
| **HttpApi CORS** | `app-staging` + optional localhost | Live origins only | Real origins | Real origins |
| **Next.js `NEXT_PUBLIC_APP_ENV`** | `staging` | `production` (treat as prod) | `production` | `production` (from `print-stack-outputs-for-web.sh`) |
| **Recommended API access** | `NEXT_PUBLIC_AUTH_PROXY=1` + `API_UPSTREAM_BASE` | same | same | same |

## Web environment variables (summary)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Canonical browser origin (`https://app.rapidcortex.us` live, `https://app-staging.rapidcortex.us` engineering). |
| `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` | Default `/…/dashboard` slug for CTAs. |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Must match stack output **`UserPoolId`**. |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Must match **`UserPoolClientId`**. |
| `NEXT_PUBLIC_COGNITO_REGION` | Same region as pool and API deploy. |
| `NEXT_PUBLIC_AUTH_PROXY` | Set to **`1`** for cookie-based auth + `/api/backend/*` proxy. |
| `API_UPSTREAM_BASE` | Server-only; HTTP API base URL from stack (**execute-api** or custom domain). |
| `NEXT_PUBLIC_API_BASE` | Alternative: direct browser → API (JWT in JS); omit when using auth proxy. |
| `NEXT_PUBLIC_OFFLINE_DEMO_MODE` | Set to **`1` only** for local dev/sales builds without an API. **Omit** on live and staging so the dashboard never shows fake incident queues ([NON_GOALS.md](./NON_GOALS.md) §5). |
| `NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM` | Set to **`1`** to show the scripted transcript chunk controls on the **dispatcher dashboard**. **Omit** on live hosts that should not imply simulated traffic is normal. |
| `NEXT_PUBLIC_DOCUMENTATION_BASE_URL` | Optional prefix to hosted **`docs/`** markdown. |
| `COGNITO_CLIENT_SECRET` | Only if app client has a secret (signup routes); usually empty. |

## Feature flags and provider overrides

- **Lambda env** controls AI and multilingual providers (`PRIMARY_PROVIDER`, `MULTILINGUAL_STRICT_VALIDATION`, etc.) — set via SAM mappings and overrides in `infra/template.yaml`.
- **Escape hatch:** `AI_ALLOW_MOCK_ONLY_IN_PROD` (Lambda only) — document if used; not for live default.

## Auth separation rule

**Never** reuse Cognito app client IDs or user pool IDs across stacks in a single browser profile for testing; tokens are not interchangeable. Use separate browser profiles or clear cookies when switching `app.rapidcortex.us` and `app-staging.rapidcortex.us`.

## Scripts

| Script | Role |
|--------|------|
| [`scripts/env-api-staging.example.sh`](../../scripts/env-api-staging.example.sh) | Engineering API env (copy to gitignored `env-api-staging.sh`). |
| [`scripts/ensure-stage-orphan-resources.sh`](../../scripts/ensure-stage-orphan-resources.sh) | Schema-only Dynamo/S3 clones for DataLayer `Existing*` names. |
| [`scripts/ensure-staging-acm-cert.sh`](../../scripts/ensure-staging-acm-cert.sh) | ACM + Route53 validation for `app-staging.rapidcortex.us`. |
| [`scripts/deploy.sh`](../../scripts/deploy.sh) | Build + `sam deploy` with stage, CORS, and DNS guards. `dev` requires `I_UNDERSTAND_DEV_IS_PROD=1`. |
| [`scripts/post-deploy-smoke.sh`](../../scripts/post-deploy-smoke.sh) | Health + unauthenticated `/api/me` check. |
| [`scripts/print-stack-outputs-for-web.sh`](../../scripts/print-stack-outputs-for-web.sh) | Emit `.env.local` suggestions from CloudFormation outputs. |
