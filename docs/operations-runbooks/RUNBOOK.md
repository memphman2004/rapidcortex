# Rapid Cortex — Operations runbook

Internal reference for **on-call engineers**, **DevOps**, and **platform operators** supporting Rapid Cortex in AWS. Pair this with [INSTALLATION.md](./INSTALLATION.md), [AWS_SETUP.md](./AWS_SETUP.md), [`infra/README.md`](../infra/README.md), [MONITORING_AND_OPS.md](./MONITORING_AND_OPS.md), [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md), [TEST_STRATEGY.md](./TEST_STRATEGY.md), and [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md). **Agency-facing symptom routing:** [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) and [ESCALATION_PATHS.md](./ESCALATION_PATHS.md).

## Service map (typical pilot)

| Layer | AWS / app | Notes |
|-------|-----------|--------|
| Web | Next.js on Vercel, ECS, or Amplify (your choice) | Served at **`https://www.rapidcortex.us/<city-town-or-county-slug>/…`** (see `apps/web/app/[jurisdiction]/`). Uses Cognito for auth; may call API **directly** or via **BFF proxy** (`NEXT_PUBLIC_AUTH_PROXY=1`). |
| API | API Gateway HTTP API + Lambda (`infra/template.yaml`) | JWT authorizer (Cognito) except documented public routes. |
| Data | DynamoDB tables, S3 assets bucket | Table names from stack / env; see template. |
| Identity | Cognito User Pool + app client | `custom:agencyId`, `custom:role` drive tenancy in the API. |

## Health checks

| Check | Command / URL | Expected |
|-------|----------------|----------|
| API liveness | `GET {HttpApiUrl}/api/health` | **200**; JSON body includes `"status":"ok"` and `"service":"rapid-cortex-api"` (see `apps/api/src/handlers/health.ts`). |
| Auth gate | `GET {HttpApiUrl}/api/me` without `Authorization` | **401** |
| Custom domain | Same paths on `ApiCustomDomainUrl` when configured | Same as above |

Automate with `./scripts/post-deploy-smoke.sh <dev|staging|prod|pilot> <region>` after deploy (wrapper: `./scripts/post_deploy_smoke.sh`). For **authenticated** checks, export `SMOKE_TEST_USERNAME` and `SMOKE_TEST_PASSWORD` (Cognito `USER_PASSWORD_AUTH`); the script asserts `GET /api/me` returns **200** and probes `GET /api/integration/status` (**200** for admin-capable users, **403** acceptable for others).

**Synthetic canary:** schedule [`scripts/synthetic-api-health.sh`](../scripts/synthetic-api-health.sh) against `HttpApiUrl` (EventBridge + Lambda, external cron, or CI).

**Concurrency probe:** [`scripts/pilot-load-smoke.sh`](../scripts/pilot-load-smoke.sh) for quick parallel `GET /api/health` after scaling or before a demo window.

## Deploy and promote

1. **Build**: from repo root, `npm ci && npm run build`.
2. **Deploy API**: `./scripts/deploy.sh dev` (or `staging` / `prod` / `pilot`). See **[DEPLOYMENT.md](./DEPLOYMENT.md)** and `infra/README.md` for CORS, domain, and ACM parameters (`API_DOMAIN_CERT_ARN`, `ROUTE53_HOSTED_ZONE_ID`, CNAME targets).
3. **Verify**: `./scripts/post-deploy-smoke.sh <stage> <region>`.
4. **Web**: deploy the Next app separately; set `NEXT_PUBLIC_API_BASE` or enable the auth proxy and set `API_UPSTREAM_BASE` (see Installation guide).

### Rollback (application)

1. **Failed deploy:** let CloudFormation **ROLLBACK_COMPLETE** finish; fix template or params; redeploy.
2. **Bad successful deploy:** redeploy the **previous known-good** SAM package (same `samconfig.toml` target, git tag, or CI artifact). Keep a **release tag per pilot window**.
3. **Web:** redeploy the prior Next.js build; purge CDN cache if you use one in front of the app.
4. **Data:** stack rollback **does not** undo DynamoDB writes. For data mistakes, use **PITR restore to a new table** ([BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md)) and cut over under change control.

Document your team’s **time-to-rollback** target (for example: API ≤ 30 minutes, web ≤ 60 minutes).

### What broke → where to look

| Symptom | First places to check |
| --- | --- |
| Elevated **5xx** | CloudWatch dashboard `HttpApi5xxAlarm` window; Lambda **Errors** for the route; recent **deploy** or **Cognito** changes |
| **Voice / STT** failures | `VoicePipelineHardFailuresAlarm`, `PostIncidentAudioChunkErrorsAlarm`, audio-chunk Lambda logs, Secrets Manager ARNs, [`RUNBOOK_MULTILINGUAL_CALLS.md`](./RUNBOOK_MULTILINGUAL_CALLS.md) |
| **AI analyze** failures | `AnalyzeIncidentErrorsAlarm`, analyze Lambda logs, Bedrock/OpenAI IAM and quotas |
| **DynamoDB user errors** | `IncidentsTableUserErrorsAlarm` / transcripts alarm; IAM policies on Lambda execution roles |
| **Throttles** | `AnalyzeIncidentThrottlesAlarm`, `PostIncidentAudioChunkThrottlesAlarm`; account-level concurrency limits |
| **Auth 401/403 everywhere** | Cognito app client id vs API authorizer audience; JWT clock skew; `custom:agencyId` / `custom:role` on tokens |

## Critical environment variables

### API (Lambda — from SAM / `Globals.Function.Environment`)

- **Tenancy / tables**: `INCIDENTS_TABLE`, `TRANSCRIPTS_TABLE`, `ANALYSES_TABLE`, `AUDIT_TABLE`, `AGENCIES_TABLE`, `INVITES_TABLE`, `BILLING_PROFILES_TABLE`, `BILLING_WEBHOOK_EVENTS_TABLE`, `ASSETS_BUCKET`.
- **Cognito**: `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION`.
- **Integration rollout**: `INTEGRATION_TRANSCRIPT_CONNECTOR_MODE` (`off` \| `shadow` \| `on`), `INTEGRATION_TRANSCRIPT_AGENCY_ALLOWLIST` (comma-separated agency IDs; empty = all eligible).
- **AI**: `PRIMARY_PROVIDER` / `SECONDARY_PROVIDER` / `TERTIARY_PROVIDER` (SAM **`ApiLambdaDefaults`** sets **bedrock** for staging/prod), secrets / IAM for OpenAI or Anthropic when those tiers are enabled, and optional **`AI_ALLOW_MOCK_ONLY_IN_PROD=true`** only for sandboxes that must keep mock analysis on a staging/prod stage label.
- **Multilingual**: `PRIMARY_*_PROVIDER` env keys (also from **`ApiLambdaDefaults`**), `MULTILINGUAL_STRICT_VALIDATION`, Azure/Google secret ARNs when those tiers are enabled, and `ASSETS_BUCKET` when **AWS Transcribe** is in the STT chain. Misconfiguration surfaces as **503** with `MULTILINGUAL_CONFIG_INVALID` on transcript, audio-chunk, and language-session routes.
- **HttpApi CORS**: SAM parameter **`HttpApiCorsAllowedOrigins`** (comma-separated, no spaces after commas); avoid `*` in real production.
- **Billing webhook**: `SQUARE_WEBHOOK_SECRET`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_NOTIFICATION_URL` (see `docs/BILLING_SQUARE.md`).

### Web (`apps/web`)

- `NEXT_PUBLIC_SITE_URL` (production: **`https://www.rapidcortex.us`**), `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` (fallback when users hit `/` only), `NEXT_PUBLIC_API_BASE` **or** `NEXT_PUBLIC_AUTH_PROXY=1` + server `API_UPSTREAM_BASE`.
- Cognito values aligned with stack outputs for sign-in routes.
- Public self-signup flags (default OFF): `NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=0`, `ENABLE_PUBLIC_SIGNUP=false`.

## Common symptoms

### 1. Users see “API not configured” or empty incident lists

- **Check**: browser network calls to API or `/api/backend/...` return **401/403/502**.
- **Verify**: `NEXT_PUBLIC_API_BASE` or proxy + `API_UPSTREAM_BASE`; API stack outputs match environment.
- **Verify**: user JWT contains `custom:agencyId` and `custom:role`.

### 2. All API requests return 401

- **Check**: `Authorization: Bearer <id token>` present (direct mode) or proxy cookie flow (proxy mode).
- **Verify**: Cognito app client id and issuer match the pool used by the API authorizer.

### 2b. Users ask for self-service signup but `/signup` is unavailable

- **Expected** in pilot/production by policy: account creation is staff/admin-led.
- **Verify** web flags:
  - `NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=0`
  - `ENABLE_PUBLIC_SIGNUP=false`
- **Temporary internal test override only**:
  - set both to enabled (`1` / `true`) for a short window, then turn back off.

### 3. Elevated 5xx from API Gateway

- **Check**: CloudWatch Logs for the **Lambda** behind the route (SAM logical name maps to function).
- **Check**: DynamoDB throttling (unlikely on PAY_PER_REQUEST unless hot keys); IAM **AccessDenied** on table or S3.
- **Mitigate**: roll back recent template change; temporarily reduce traffic (throttle already set on HttpApi `DefaultRouteSettings`).

### 4. Integration status always “off” / no external transcript

- **Expected** unless `INTEGRATION_TRANSCRIPT_CONNECTOR_MODE` is `shadow` or `on` and adapters are implemented—see [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md).

### 5. Square webhook duplicates or failures

- See `docs/BILLING_SQUARE.md` and the `BillingWebhookEvents` idempotency table.

## Security and compliance operations

- **Credential rotation**: rotate Cognito app secrets (if any), Square keys, and shared webhook secrets on the schedule in your security policy.
- **Audit**: ensure new sensitive handlers write to `AUDIT_TABLE` with types from `packages/security` audit vocabulary.
- **CJIS**: follow your agency’s CJIS policy; Rapid Cortex documentation describes **alignment**, not certification—see pilot docs under `docs/phase-0`.

## Escalation

1. **L1** — Confirm health endpoints, recent deploys, and env drift.
2. **L2** — CloudWatch deep dive, IAM policy changes, Cognito pool issues.
3. **L3** — Application bug triage, vendor (AWS) support cases.

## Related documents

- [INSTALLATION.md](./INSTALLATION.md)
- [USER_GUIDE.md](./USER_GUIDE.md)
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)
- [SUPPORT_MODEL.md](./SUPPORT_MODEL.md)
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)
- [MONITORING_AND_OPS.md](./MONITORING_AND_OPS.md)
- [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)
