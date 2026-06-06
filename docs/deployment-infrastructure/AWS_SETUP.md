# Complete AWS setup (Rapid Cortex)

This guide ties together **SAM** (`infra/template.yaml`), **scripts**, and **downstream configuration** so the API, Cognito, multilingual voice, and the Next.js app are ready in AWS. For stage isolation and CORS rules, see **[DEPLOYMENT.md](./DEPLOYMENT.md)** and **[ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)**.

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **AWS account** | Prefer separate accounts or clear namespaces for dev / staging / prod. |
| **Tools** | Node.js **22+**, **npm**, **AWS CLI v2**, **AWS SAM CLI**, **git**. |
| **Credentials** | `aws sts get-caller-identity` succeeds; deploy principal matches [`infra/iam/sam-deploy-policy.json`](../infra/iam/sam-deploy-policy.json) (edit placeholders). |
| **Region** | Pick one region (e.g. `us-east-1`) for HTTP API, Lambda, DynamoDB, Cognito, S3. |

## One-command local prepare + optional deploy

From the repository root:

```bash
chmod +x scripts/aws-setup.sh scripts/deploy.sh scripts/post-deploy-smoke.sh scripts/print-stack-outputs-for-web.sh
./scripts/aws-setup.sh
```

This runs **`npm install`**, **`npm run build`**, **`npm install --prefix infra/cognito-post-confirmation`**, and **`sam validate`**.

### Deploy the API stack

```bash
./scripts/aws-setup.sh --deploy dev
# or
HTTP_API_CORS_ORIGINS="https://www.rapidcortex.us" ./scripts/deploy.sh staging
# pilot stack (single-agency production-like):
# HTTP_API_CORS_ORIGINS="https://www.example.org" ./scripts/deploy.sh pilot
```

Optional **deploy** environment variables (see [`infra/README.md`](../infra/README.md)):

- `ROOT_DOMAIN`, `API_SUBDOMAIN_PREFIX`, `API_DOMAIN_CERT_ARN`, `ROUTE53_HOSTED_ZONE_ID`
- `APP_CNAME_TARGET`, `ADMIN_CNAME_TARGET`, `WWW_CNAME_TARGET`
- **`HTTP_API_CORS_ORIGINS`** — comma-separated origins for the HttpApi (no spaces after commas). For production, set to your real **www** host(s); avoid `*`.

### User onboarding model (recommended)

Rapid Cortex production/pilot environments should use **staff/admin-led provisioning**:

- Rapid Cortex staff creates the first municipality admin.
- Municipality admin creates additional users from the in-app admin tools.
- Public self-signup stays disabled by default in `apps/web`.

Web flags (in `apps/web/.env.local` or host env):

- `NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=0`
- `ENABLE_PUBLIC_SIGNUP=false`

Only enable both for controlled internal testing windows:

- `NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=1`
- `ENABLE_PUBLIC_SIGNUP=true`

### DynamoDB table purpose map (backend)

When deployed with `DDB_TABLE_PREFIX=rapid-cortex`, tables are named like `rapid-cortex-<domain>-<stage>` (for example `rapid-cortex-incidents-dev`).

- `agencies` — agency / jurisdiction records and configuration.
- `invites` — user invite lifecycle for onboarding and access.
- `incidents` — primary incident records and status.
- `transcripts` — transcript chunks/messages per incident.
- `analyses` — AI analysis outputs and metadata.
- `audit` — immutable audit events for user/system actions.
- `access-overrides` — Agency Admin grants/revocations of temporary or permanent role/permission/feature overrides scoped by agency (see handlers under `/api/agency-admin/overrides`).
- `api-clients` — OAuth-style machine credentials scoped per agency (`/api/agency-admin/api-clients`, external `/api/v1/oauth/token`).
- `webhooks` — outbound signed webhook registrations per agency.
- `external-api-rate` — per-agency/per-client minute buckets for REST API rate limits (TTL on `expiresAt`).
- `language-sessions` — multilingual call session state.
- `incident-media` — media upload/request metadata tied to incidents.
- `live-video-sessions` — live video session lifecycle metadata.
- `video-assist-sessions` — video assist workflow session records.
- `silent-text-sessions` — silent-text conversation sessions/messages.
- `qa-sessions` — QA scoring session instances.
- `qa-templates` — QA scoring templates/rubrics.
- `trauma-flags` — dispatcher wellness / trauma flag records.
- `premise-notes` — premise/caller notes for caller-card context.
- `dispatcher-coaching-notes` — supervisor coaching notes.
- `incident-shares` — cross-jurisdiction incident share records.
- `agency-share-partners` — configured external sharing partners.
- `billing-profiles` — agency subscription/billing profile state.
- `billing-webhook-events` — billing webhook event log/idempotency tracking.

### After deploy: smoke tests

```bash
./scripts/post-deploy-smoke.sh dev us-east-1
```

### Web app environment from stack outputs

```bash
./scripts/print-stack-outputs-for-web.sh prod us-east-1
```

Copy the printed block into **`apps/web/.env.local`** or your hosting provider. Adjust **`NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG`** to your primary city/county slug.

### Bootstrap first admin users (required)

Run these from an authenticated AWS CLI profile in the same region as your user pool:

```bash
export AWS_PROFILE=rapid-cortex
export AWS_REGION=us-east-1
export USER_POOL_ID="<your-user-pool-id>"
```

1) **Seed first Rapid Cortex platform superadmin** (internal staff only):

```bash
aws cognito-idp admin-create-user \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --user-pool-id "$USER_POOL_ID" \
  --username "platform.admin@rapidcortex.us" \
  --user-attributes \
    Name=email,Value=platform.admin@rapidcortex.us \
    Name=email_verified,Value=true \
    Name=custom:agencyId,Value=__platform__ \
    Name=custom:role,Value=platform_superadmin \
  --temporary-password 'ChangeMeNow!234' \
  --message-action SUPPRESS
```

2) **Seed first municipality admin** (per agency):

```bash
aws cognito-idp admin-create-user \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --user-pool-id "$USER_POOL_ID" \
  --username "admin@municipality.gov" \
  --user-attributes \
    Name=email,Value=admin@municipality.gov \
    Name=email_verified,Value=true \
    Name=custom:agencyId,Value=<agency-id> \
    Name=custom:role,Value=admin \
  --temporary-password 'ChangeMeNow!234' \
  --message-action SUPPRESS
```

3) Optional: set permanent password during controlled bootstrap windows:

```bash
aws cognito-idp admin-set-user-password \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --user-pool-id "$USER_POOL_ID" \
  --username "admin@municipality.gov" \
  --password '<StrongPassword!234>' \
  --permanent
```

## SAM configuration profiles (optional)

[`samconfig.toml`](../samconfig.toml) defines **`dev`**, **`staging`**, and **`prod`** profile names for `sam deploy --config-env <name>`. The repository’s **`./scripts/deploy.sh`** does not require `samconfig.toml`; it passes **`--parameter-overrides`** explicitly. Use either approach consistently in CI.

## Post-deploy checklist (operators)

1. **Secrets (managed multilingual mode)**  
   If you used **`MultilingualSecretProvisioning=managed`**, replace placeholder values in Secrets Manager (see [`DEPLOYMENT_MULTILINGUAL_AWS.md`](./DEPLOYMENT_MULTILINGUAL_AWS.md)).

2. **AI keys (optional)**  
   If you override **`PRIMARY_PROVIDER`** to OpenAI or Anthropic, set **`OPENAI_API_KEY_SECRET_ARN`** / **`ANTHROPIC_API_KEY_SECRET_ARN`** (stack parameters) or Lambda env in the console.

3. **Bootstrap first municipality admin**  
   Ensure the agency row exists in DynamoDB, then create the first admin user with explicit Cognito attributes:
   - `custom:agencyId=<agency-id>`
   - `custom:role=admin`  
   Keep public signup disabled unless running controlled internal tests ([`COGNITO_SELF_SIGNUP.md`](./COGNITO_SELF_SIGNUP.md)).

4. **Bedrock (staging/prod defaults)**  
   **`ApiLambdaDefaults`** sets **Bedrock** for analysis in staging/prod. Confirm **Bedrock model access** in the account/region.

5. **CORS**  
   **`HttpApiCorsAllowedOrigins`** must include the exact origin(s) your browser uses for the Next app (scheme + host, no trailing slash).

6. **Web deploy**  
   Deploy **`apps/web`** separately; use **`NEXT_PUBLIC_AUTH_PROXY=1`** and **`API_UPSTREAM_BASE`** when using the BFF pattern ([`INSTALLATION.md`](./INSTALLATION.md)).

## Related documents

| Document | Purpose |
|----------|---------|
| [`INSTALLATION.md`](./INSTALLATION.md) | Local + AWS + web env reference |
| [`RUNBOOK.md`](./RUNBOOK.md) | Day-2 operations |
| [`infra/README.md`](../infra/README.md) | Domains, ACM, IAM, CORS parameter |
| [`DEPLOYMENT_MULTILINGUAL_AWS.md`](./DEPLOYMENT_MULTILINGUAL_AWS.md) | Voice secrets, strict validation, stage defaults |
| [`COGNITO_SELF_SIGNUP.md`](./COGNITO_SELF_SIGNUP.md) | Cognito admin-led provisioning model + controlled self-signup test path |
