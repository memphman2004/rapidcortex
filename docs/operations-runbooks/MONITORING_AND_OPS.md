# Monitoring and operations (pilot)

This document is the **operator-facing** guide for CloudWatch visibility, alarms, and synthetic checks. Infrastructure definitions live in [`infra/template.yaml`](../infra/template.yaml). Legacy notes also appear in [`infra/monitoring-and-ops.md`](../infra/monitoring-and-ops.md); treat **this file** as the canonical pilot checklist.

## What ships in the SAM stack

### CloudWatch dashboard

- **Logical resource:** `PilotOperationsDashboard`
- **Name pattern:** `rapid-cortex-<DeploymentStage>-ops` (stack output `PilotOperationsDashboardName`)
- **Widgets (summary):**
  - HTTP API **4xx / 5xx** (`AWS/ApiGateway`, `ApiId` + `Stage` `$default`)
  - Lambda **Errors** and **Throttles** for analyze + multilingual audio-chunk functions
  - Lambda **Duration p95** for the same functions
  - DynamoDB **Incidents** table consumed capacity and **UserErrors / SystemErrors**
  - Custom **voice pipeline hard failures** metric (see below)

Open the dashboard from **CloudWatch → Dashboards → Custom** and search for `rapid-cortex-<stage>-ops`.

### SNS ops topic

- **Logical resource:** `OpsAlertsTopic`
- **Output:** `OpsAlertsTopicArn`
- **Action:** subscribe your on-call email, SMS, Slack/AWS Chatbot, or ticketing integration. Alarms publish here; **no subscription means no notification delivery**.

### Alarms (all wired to `OpsAlertsTopic`)

| Alarm | Signal | Typical cause |
| --- | --- | --- |
| `AnalyzeIncidentErrorsAlarm` | Lambda `Errors` on analyze | Auth, validation, Bedrock/IAM, guardrails |
| `AnalyzeIncidentDurationP95Alarm` | Analyze `Duration` p95 | Cold start, model latency, large transcripts |
| `PostIncidentAudioChunkErrorsAlarm` | Audio chunk `Errors` | STT/Translate/Transcribe, secrets, S3 |
| `PostIncidentAudioChunkDurationP95Alarm` | Audio chunk `Duration` p95 | Batch transcribe, large payloads |
| `HttpApi5xxAlarm` | API `5xx` sum | Cascading Lambda failures, authorizer, integration |
| `HttpApiIntegrationLatencyP95Alarm` | API `IntegrationLatency` p95 | Upstream slowness, concurrency pressure |
| `AnalyzeIncidentThrottlesAlarm` | Analyze `Throttles` | Account concurrency / burst limits |
| `PostIncidentAudioChunkThrottlesAlarm` | Audio chunk `Throttles` | Same, on voice path |
| `VoicePipelineHardFailuresAlarm` | Log metric `PipelineHardFailures` | Provider failures (`stt_failure`, `translation_failure`, `language_detect_failure` in structured logs) |
| `IncidentsTableUserErrorsAlarm` | DynamoDB `UserErrors` | IAM, conditional check failures, schema drift |
| `TranscriptsTableUserErrorsAlarm` | DynamoDB `UserErrors` | Same on transcript index |

Thresholds are **starting points**; tune per agency traffic after the first week of pilot data.

### Log-derived voice metric

- **Log group:** `/aws/lambda/<PostIncidentAudioChunkFunction>` (explicit `PostIncidentAudioChunkLogGroup`, 30-day retention)
- **Metric filter:** `PostIncidentAudioChunkVoiceFailuresMetricFilter` → namespace `RapidCortex/<stage>/Voice`, metric `PipelineHardFailures`

If logs never arrive (function not invoked), the custom metric stays empty (alarms use `TreatMissingData` where applicable).

## Hosted web login & auth signals (`apps/web` on ECS Fargate)

When the marketing/app shell ships as **ECS Fargate SSR** (`infra/web-ssr-infra-template.yaml`), application stdout/stderr lands in CloudWatch Logs:

| Item | Typical log group |
| --- | --- |
| Next.js **`nextjs-web`** container | **`/ecs/<AppName>-web-<DeploymentStage>`** (e.g. **`/ecs/rapid-cortex-web-prod`**) |

**What to watch (login UX & auth path):**

- **`security.csp_violation`** JSON lines from **`/api/csp-report`** (`documentUri` often `…/login` or `…/demo/login`). If **`violatedDirective`** is **`script-src-elem`** / **`script-src-attr`** and **`blockedUri`** is **`inline`**, inline scripts violated the **effective** CSP—not always the same text as **`curl`** on one hop: **CloudFront/WAF/other layers** sometimes add another **`Content-Security-Policy`**; browsers **intersect** enforcing policies (**most restrictive wins** per directive). Report-only (**`Content-Security-Policy-Report-Only`**) does **not** block—it only reports. Prod app CSP (**`next.config`**) **`script-src`** is **`'self' 'wasm-unsafe-eval'`** (no **`unsafe-inline`**): if enforcing that policy **and** violations show **`inline`**, fix with hashes/nonce, set **`NEXT_PUBLIC_CSP_ENFORCE=false`** (**report-only** rollout), or align every layer—**`style-src`** still allows **`unsafe-inline`** for hydration styles.
- **Thrown** sign-in upstream errors: handler logs **`[signin]`** with **`console.error`** (**`apps/web/app/api/auth/signin/route.ts`**). **Quiet 401 Invalid credentials / 403 CSRF** responses often leave **no** line—use **ALB access logs**, **browser Network tab**, or add temporary structured middleware logging if you need counts in CloudWatch.
- **Burst throttling**: mapper returns **429** with **`TooManyRequestsException`** (**`apps/web/lib/cognito-route-errors.ts`**); correlate with Cognito advanced security / account lockout in **Cognito console**.

**Operational hooks:**

- Scripted CSRF/sign-in probes: [`scripts/test-csrf-validation.sh`](../../scripts/test-csrf-validation.sh), [`scripts/test-auth-errors.sh`](../../scripts/test-auth-errors.sh).
- Expected HTTP bodies reference: [`customer-readiness-gate.md`](../customer-readiness-gate.md) **§5B**.

Consider **metric filters** or **Contributor Insights** on `POST /api/auth/signin` if ALB/access logs ship to CloudWatch Logs (infra-dependent).

## Synthetic checks

| Check | Script / path | Notes |
| --- | --- | --- |
| Public liveness | `GET /api/health` | No auth; assert **200** and JSON `status=ok`, `service=rapid-cortex-api` |
| Cron-friendly | [`scripts/synthetic-api-health.sh`](../scripts/synthetic-api-health.sh) | Set `API_BASE_URL` or pass base URL as arg |
| Post-deploy | [`scripts/post-deploy-smoke.sh`](../scripts/post-deploy-smoke.sh) | Health + `401` on `/api/me`; optional auth (below) |
| Auth path | Same script with `SMOKE_TEST_USERNAME` / `SMOKE_TEST_PASSWORD` | Cognito `USER_PASSWORD_AUTH`; checks `/api/me` **200** and `/api/integration/status` **200 or 403** |

For **EventBridge**: schedule `synthetic-api-health.sh` every 1–5 minutes from a tiny runner (Lambda, CI, or bastion) that has outbound HTTPS.

## Pilot concurrency probe

[`scripts/pilot-load-smoke.sh`](../scripts/pilot-load-smoke.sh) runs parallel `GET /api/health` (not authenticated). Use after deploy or scaling changes:

```bash
API_BASE_URL="https://xxxx.execute-api....amazonaws.com" CONCURRENCY=30 REQUESTS=300 ./scripts/pilot-load-smoke.sh
```

This is **not** a substitute for formal load testing; pair with your expected dispatcher concurrency and multilingual audio volume.

## Where to look (first 10 minutes)

1. **CloudWatch dashboard** for the stage — correlate API 5xx with Lambda errors and voice failures.
2. **Hosted web ECS log group** (see **[Hosted web login & auth signals](#hosted-web-login--auth-signals-appsweb-on-ecs-fargate)**) — CSP reports from login pages and any **`[signin]`** error lines during Cognito outages.
3. **Lambda log groups** for the failing route (logical name matches handler in SAM).
4. **API Gateway** access logs (enable if not already) for `requestId` correlation.
5. **DynamoDB** metrics if alarms fire on `UserErrors` — usually IAM or conditional expressions.
6. **SNS / subscriptions** — confirm `OpsAlertsTopic` has active subscribers.

For **cannot sign in / 403 CSRF**: confirm **`POST /api/auth/signin`** in ALB (or CDN) logs, **Origin** apex vs **`www`** vs **`APP_ALLOWED_ORIGINS`**, double-submit **`rc_csrf_token`** (**§5B** gate doc).

## Related documents

- [`RUNBOOK.md`](./RUNBOOK.md) — symptoms, rollback, env drift
- [`BACKUP_AND_RECOVERY.md`](./BACKUP_AND_RECOVERY.md) — PITR and restore
- [`RUNBOOK_MULTILINGUAL_CALLS.md`](./RUNBOOK_MULTILINGUAL_CALLS.md) — voice path deep dive
- [`TEST_STRATEGY.md`](./TEST_STRATEGY.md) — CI vs post-deploy verification
