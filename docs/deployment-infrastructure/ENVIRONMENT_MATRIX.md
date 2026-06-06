# Environment matrix — stacks vs app configuration

Use this table to keep **AWS stacks**, **Next.js public env**, and **BFF proxy** aligned. One row = one consistent environment (no cross-pool tokens, no cross-stack API URLs).

**Long-form reference:** [ENVIRONMENT_CONFIGURATION_REFERENCE.md](./ENVIRONMENT_CONFIGURATION_REFERENCE.md) · **Flags:** [FEATURE_FLAGS.md](./FEATURE_FLAGS.md).

| Concern | dev | staging | prod | pilot |
|--------|-----|---------|------|-------|
| **SAM stack** | `rapid-cortex-dev` | `rapid-cortex-staging` | `rapid-cortex-prod` | `rapid-cortex-pilot` |
| **`DeploymentStage` param** | `dev` | `staging` | `prod` | `pilot` |
| **Cognito user pool** | Stack-owned; name `rapid-cortex-users-<stage>` | same pattern | same pattern | same pattern |
| **Cognito domain prefix** | `rapidcortex-<stage>-<accountId>` | same | same | same |
| **DynamoDB tables** | CFN-physical names per stack (see `!Ref` in Lambdas) | same | same | same |
| **S3 assets bucket** | `rapid-cortex-assets-dev-<accountId>` | …-staging-… | …-prod-… | …-pilot-… |
| **API default AI / multilingual** | Mock-heavy (see `ApiLambdaDefaults` in `infra/template.yaml`) | Bedrock + AWS tiers | Bedrock + AWS tiers | Same as **prod** in mappings |
| **Multilingual strict validation** | `false` | `true` | `true` | `true` |
| **HttpApi CORS** | Often `*` locally | Real browser origins | Real origins | Real origins |
| **Next.js `NEXT_PUBLIC_APP_ENV`** | `development` | `staging` | `production` | `production` (from `print-stack-outputs-for-web.sh`) |
| **Recommended API access** | `NEXT_PUBLIC_AUTH_PROXY=1` + `API_UPSTREAM_BASE` | same | same | same |

## Web environment variables (summary)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Canonical browser origin for links (e.g. `https://www.rapidcortex.us`). |
| `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` | Default `/…/dashboard` slug for CTAs. |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Must match stack output **`UserPoolId`**. |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Must match **`UserPoolClientId`**. |
| `NEXT_PUBLIC_COGNITO_REGION` | Same region as pool and API deploy. |
| `NEXT_PUBLIC_AUTH_PROXY` | Set to **`1`** for cookie-based auth + `/api/backend/*` proxy. |
| `API_UPSTREAM_BASE` | Server-only; HTTP API base URL from stack (**execute-api** or custom domain). |
| `NEXT_PUBLIC_API_BASE` | Alternative: direct browser → API (JWT in JS); omit when using auth proxy. |
| `NEXT_PUBLIC_OFFLINE_DEMO_MODE` | Set to **`1` only** for local dev/sales builds without an API. **Omit** on pilot/production so the dashboard never shows fake incident queues ([NON_GOALS.md](./NON_GOALS.md) §5). |
| `NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM` | Set to **`1`** to show the scripted transcript chunk controls on the **dispatcher dashboard** (POSTs to the live transcript API when selected). **Omit** on pilot hosts that should not imply simulated traffic is normal; `/demo` remains the primary academy path ([NON_GOALS.md](./NON_GOALS.md) §5). |
| `NEXT_PUBLIC_DOCUMENTATION_BASE_URL` | Optional prefix to hosted **`docs/`** markdown (e.g. internal docs portal base URL) for **Admin → Pilot hub** and marketing evaluation links ([GTM_PACKAGE.md](./GTM_PACKAGE.md)). |
| `COGNITO_CLIENT_SECRET` | Only if app client has a secret (signup routes); usually empty. |

## Feature flags and provider overrides

- **Lambda env** controls AI and multilingual providers (`PRIMARY_PROVIDER`, `MULTILINGUAL_STRICT_VALIDATION`, etc.) — set via SAM mappings and overrides in `infra/template.yaml`.
- **Escape hatch:** `AI_ALLOW_MOCK_ONLY_IN_PROD` (Lambda only) — document if used; not for live pilot default.

## Auth separation rule

**Never** reuse Cognito app client IDs or user pool IDs across stacks in a single browser profile for testing; tokens are not interchangeable. Use separate browser profiles or clear cookies when switching environments.

## Scripts

| Script | Role |
|--------|------|
| [`scripts/deploy.sh`](../scripts/deploy.sh) | Build + `sam deploy` with stage and CORS guard. |
| [`scripts/post-deploy-smoke.sh`](../scripts/post-deploy-smoke.sh) | Health + unauthenticated `/api/me` check. |
| [`scripts/print-stack-outputs-for-web.sh`](../scripts/print-stack-outputs-for-web.sh) | Emit `.env.local` suggestions from CloudFormation outputs. |
