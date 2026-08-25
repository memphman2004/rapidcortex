# Rapid Cortex Dev — Stress Test Report
**Date:** 2026-08-17  
**Stack:** `rapid-cortex-dev` (confirmed CREATE/UPDATE_COMPLETE family; parent status `UPDATE_COMPLETE`)  
**Environment:** Development (live) — DeploymentStage=`dev` in AWS account `158961537080` (`us-east-1`, profile `rapid-cortex`)  
**Tester:** Claude Code (automated)  
**Window (UTC):** monitor start `2026-08-17T04:07:13Z` → monitor stop `2026-08-17T04:15:02Z`

## Environment

| Item | Value |
|---|---|
| Parent stack | `rapid-cortex-dev` |
| Parent status | `UPDATE_COMPLETE` (last updated 2026-08-16T06:17:44Z) |
| Nested API stack (primary) | `rapid-cortex-dev-AppSamStackV2-1BR5EYUP7MO39` |
| HTTP API id | `k26yw4o3xk` |
| API base URL (Step 1 `HttpApiUrl`) | `https://k26yw4o3xk.execute-api.us-east-1.amazonaws.com` |
| Custom domain (not used for load) | `https://api.rapidcortex.us` |
| Region | `us-east-1` |
| Health probe (pre-wave) | `GET /api/health` → **HTTP 200** in 6.694s (cold), body `{"status":"ok","service":"rapid-cortex-api","deploymentStage":"unknown","stackId":"1"}` |
| ECS cluster/service monitored | `rapid-cortex-v2-web-prod` / `rapid-cortex-v2-web-prod` (no `rapid-cortex-web-dev` cluster exists) |
| Load path | execute-api HTTP API → Lambda. **Does not traverse CloudFront or ECS.** ECS/CloudFront gates are environmental, not stressed by these waves. |

Additional HttpApi URLs on the same parent (not targeted):

- HttpApi2Url `https://t4bdwpjfs5.execute-api.us-east-1.amazonaws.com`
- HttpApi3Url `https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com`
- HttpApi4Url `https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com`
- HttpApi5Url `https://ubartq53a8.execute-api.us-east-1.amazonaws.com`

## Method notes

- `scripts/pilot-load-smoke.sh` only hits `/api/health` and does not emit p50/p99. Each wave ran an instrumented concurrent GET (same concurrency/request counts) **and** the repo smoke script.
- Percentiles below are from the instrumented runner (`results/http-load-wave.py`). Smoke-script OK/FAIL is noted per wave.
- CloudWatch monitor: `STAGE=dev AWS_PROFILE=rapid-cortex ./scripts/rc-stress-monitor.sh` → `results/stress-monitor-dev.log`.

## Baseline Metrics (pre-load)

Captured ~90s after monitor start, **before Wave 1**, window 300s ending `2026-08-17T04:08:53Z`.

| Metric | Baseline | Notes |
|---|---|---|
| Lambda error rate | **~2–4 Errors/min**, sum **15** over 5 min | All from `rapid-cortex-dev-AppSam5St-CameraHeartbeatFunction-T6N8rQwPjQXT` (31 Errors in prior 10 min). Pre-existing; not health-path. |
| DynamoDB throttle events | **0** | `ThrottledRequests` / `ReadThrottleEvents` / `WriteThrottleEvents` empty for `TableName=rapid-cortex*` |
| DynamoDB WCU (audit/incidents) | **0** | Monitor: `rapid-cortex-audit-dev`, `rapid-cortex-incidents-dev` |
| API Gateway p99 latency (`ApiId=k26yw4o3xk`) | **781 ms** (04:07) | Matches the single cold `/api/health` probe (client 6.7s includes TLS/cold start; CW p99 is API Gateway Latency) |
| API Gateway 5xx | **0** | |
| ECS CPU % | avg **0.33–0.39%**, peak max **1.15%** | Web SSR prod service idle |
| ECS Memory % | avg **10.1–10.2%**, peak max **10.69%** | |
| CloudFront 5xx error rate | **0%** on distributions with datapoints (`EWZ286WS69KX1`, `E22OK65GJG6A2C`, `E291VQMYJ94GEI`); others no samples | Load did not hit CloudFront |

Monitor sample (04:07:13Z):

```
ECS mem avg=10.1% max=10.6%
DDB WCU rapid-cortex-audit-dev  sum=0
DDB WCU rapid-cortex-incidents-dev  sum=0
```

## Wave Results

Target: `GET ${API_URL}/api/health`

| Wave | Concurrency | Requests | Success Rate | p50 | p99 | Errors |
|---|---|---|---|---|---|---|
| 1 — Warm-up | 10 | 100 | **100%** (100/100 HTTP 200) | **157 ms** | **591 ms** | 0. Smoke script: OK |
| 2 — Moderate | 30 | 300 | **100%** (300/300 HTTP 200) | **170 ms** | **304 ms** | 0. Smoke script: OK |
| 3 — Peak | 60 | 600 | **97.83%** (587/600 HTTP 200) | **220 ms** | **355 ms** | **13 × HTTP 429**. No 5xx. Smoke script immediately after: mass 429 (rate-limit already consumed) |

Client-side detail:

| Wave | Elapsed | avg | min | max | Status mix |
|---|---|---|---|---|---|
| 1 | 1.915s | 185 ms | 137 ms | 601 ms | 200×100 |
| 2 | 1.913s | 179 ms | 135 ms | 395 ms | 200×300 |
| 3 | 2.408s | 227 ms | 135 ms | 391 ms | 200×587, 429×13 |

CloudWatch after waves (API `k26yw4o3xk`):

| Minute (UTC) | APIGW Latency p99 | APIGW 5xx | APIGW 4xx |
|---|---|---|---|
| 04:07 | 781 ms | 0 | 0 |
| 04:09 | 446 ms | 0 | 0 |
| 04:10 | 39–43 ms | 0 | 0 |
| 04:11 | 30 ms | 0 | **418** (Wave 3 429s + follow-on smoke) |

Lambda Throttles (`FunctionName=rapid-cortex-dev*`): **none** during the test window.  
Health function `rapid-cortex-dev-AppSamStackV2-1BR5-HealthFunction-7ntwCgRvu0zE`: no reserved concurrency set.

### Monitor after Wave 1 (`~04:09:50Z`)

ECS mem avg 10.2% / max 10.7%. DDB WCU 0. Lambda Errors still ~2–4/min (CameraHeartbeat). APIGW p99 301 ms at 04:09. APIGW 5xx 0.

### Monitor after Wave 2 (`~04:10:52Z`)

ECS mem unchanged. DDB WCU 0. APIGW p99 43 ms at 04:10. APIGW 5xx 0.

### Monitor after Wave 3 + 60s settle (`~04:12:59Z`)

ECS CPU peak still **1.15%**. ECS memory peak **10.74%**. DDB throttles **0**. APIGW 5xx **0**. Lambda Errors pattern unchanged (CameraHeartbeat). APIGW 4xx **418** at 04:11.

## Endpoint Results

`CONCURRENCY=20 REQUESTS=100` against **stack-1 `HttpApiUrl`** as specified.

| Endpoint | Requests | Success Rate (HTTP 2xx) | p99 Latency | Observed status |
|---|---|---|---|---|
| `/api/auth/session` | 100 | **0%** | **233 ms** | **100 × HTTP 404** `{"message":"Not Found"}` |
| `/api/rc-admin/agencies` | 100 | **0%** | **239 ms** | **100 × HTTP 404** `{"message":"Not Found"}` |

Single-request routing checks (not part of the 100-request waves):

| URL | HTTP | Body (truncated) |
|---|---|---|
| `https://k26yw4o3xk.execute-api.us-east-1.amazonaws.com/api/auth/session` | 404 | `{"message":"Not Found"}` |
| `https://k26yw4o3xk.execute-api.us-east-1.amazonaws.com/api/rc-admin/agencies` | 404 | `{"message":"Not Found"}` |
| `https://api.rapidcortex.us/api/auth/session` | 404 | `{"message":"Not Found"}` |
| `https://api.rapidcortex.us/api/rc-admin/agencies` | 404 | `{"message":"Not Found"}` |
| `https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com/api/rc-admin/agencies` | 404 | `{"message":"Not Found"}` |
| `https://app.rapidcortex.us/api/auth/session` | **200** | `{"user":null}` (Next.js BFF; unauthenticated) |

These 404s are **routing**, not overload: API Gateway returned quickly with 0 transport errors and 0 5xx.

## Pass/Fail

| Criteria | Target | Actual | Result |
|---|---|---|---|
| Lambda 5xx errors | 0 | API Gateway 5xx on `k26yw4o3xk` = **0**. Health path = **0** 5xx. CloudWatch Lambda `Errors` = **~2–4/min** throughout from CameraHeartbeat (pre-existing, unchanged by load) | **FAIL** if counting Lambda `Errors`; **PASS** for API 5xx / health-path |
| DynamoDB throttles | 0 | **0** | **PASS** |
| API Gateway p99 | <1000ms | CW max **781 ms** (cold 04:07); during load **30–446 ms**. Client wave p99 **591 / 304 / 355 ms** | **PASS** |
| ECS CPU peak | <80% | **1.15%** (web SSR idle; API load did not hit ECS) | **PASS** (not exercised by this API test) |
| ECS Memory peak | <85% | **10.74%** | **PASS** (not exercised by this API test) |
| CloudFront 5xx rate | <1% | **0%** where sampled | **PASS** (not exercised by this API test) |
| Wave 3 success (informational) | n/a | **97.83%** with **13 × 429** | **FAIL** vs a 100% success bar |

## Issues Found

### 1. HTTP 429 at 60-concurrent peak — API Gateway stage throttle (primary load finding)

**What:** Wave 3 instrumented run: 13/600 `GET /api/health` returned **429**. Follow-on `pilot-load-smoke.sh` (another 600 at concurrency 60, immediately after) was almost entirely 429. CloudWatch `AWS/ApiGateway` `4xx` = **418** in the 04:11 minute. **Zero** Lambda `Throttles`. **Zero** API 5xx.

**Root cause:** HTTP API `$default` stage `DefaultRouteSettings`:

- `ThrottlingRateLimit`: **100 req/s**
- `ThrottlingBurstLimit`: **200**

Confirmed live via `aws apigatewayv2 get-stage --api-id k26yw4o3xk --stage-name $default`. Source in `infra/nested/stack-app-sam.yaml` (`Api` resource, `DefaultRouteSettings`).

Wave 3 issued 60 concurrent requests that completed in **2.4s** (~250 rps burst), which exceeds burst 200 and sustained 100 rps. Waves 1–2 stayed under the cap (100 @ 10 and 300 @ 30 finished in ~1.9s).

**Recommended fix:** Raise HttpApi throttle for live ops (example: rate 1000 / burst 2000, or per-route limits) if 60 concurrent dispatch/health clients are in-scope. Keep WAF rate-based rules as the abuse control, not the 100 rps API Gateway cap. Do not treat 429 here as Lambda exhaustion.

### 2. `/api/auth/session` is not on the SAM HttpApi

**What:** 100/100 **404** on `${HttpApiUrl}/api/auth/session`. Same 404 on `https://api.rapidcortex.us/api/auth/session`. **200** on `https://app.rapidcortex.us/api/auth/session` (`{"user":null}`).

**Root cause:** Session is a Next.js App Router BFF route on the web SSR origin, not a Lambda HTTP API route.

**Recommended fix:** Stress this path against `https://app.rapidcortex.us` (ECS), with an optional authenticated cookie/JWT. That is the test that would move ECS CPU/memory.

### 3. `/api/rc-admin/agencies` does not exist as a list route

**What:** 100/100 **404** on `${HttpApiUrl}/api/rc-admin/agencies` and on HttpApi3 / custom domain.

**Root cause:** SAM list handler is `GET /api/agencies` (`ListAgenciesFunction` in `stack-app-sam.yaml`). Web BFF has `/api/rc-admin/agencies/[agencyId]/...` sub-routes only (billing, escalation-relationship, add-ons). There is no collection `GET /api/rc-admin/agencies`.

**Recommended fix:** Load-test `GET ${API_URL}/api/agencies` with a Cognito JWT (expects 401 without auth, 200 with rc-admin). Do not treat the 404 as an outage.

### 4. Pre-existing CameraHeartbeat Lambda Errors

**What:** `CameraHeartbeatFunction` (`...-T6N8rQwPjQXT`) emitted **~2–4 Errors per minute** from 04:02 through 04:11, totaling 31 in 10 minutes and 15 in the 5-minute baseline. Pattern **did not increase** during health waves. Log filter for ERROR/Exception in a 15-minute window returned no sample lines (metric-only or non-matching log format).

**Recommended fix:** Inspect that function’s schedule, downstream (KVS/camera), and alarms separately. Do not block on it for HttpApi health capacity. Track as a live-ops defect independent of this stress run.

### 5. ECS / CloudFront gates were not on the request path

API load used execute-api. Product UI is ECS (`rapid-cortex-v2-web-prod`); marketing/app CDN is CloudFront. Passing ECS <80% CPU and CF 5xx <1% only shows those services were idle/healthy, not that they survive this load.

**Recommended fix:** A production-readiness pass should include `https://app.rapidcortex.us` page/BFF GETs if ECS memory/CPU is in-scope.

### 6. `pilot-load-smoke.sh` is a brittle peak probe

`curl -sSf` + `xargs -P` exits on the first 429 and dumps concurrent curl errors. Use an instrumented runner (or k6 `scripts/perf/rc-stress-test.js`) for percentiles and non-2xx accounting.

## Verdict

**ISSUES FOUND — list what needs fixing before production**

The live **dev HttpApi health path is capacity-healthy** under 10 and 30 concurrent clients: 100% HTTP 200, client p99 **591 ms then 304 ms**, no DynamoDB throttles, no API 5xx, no Lambda throttles.

It is **not** a clean “DEV STACK HEALTHY” stamp because:

1. **Default HttpApi throttle (100 rps / burst 200) sheds 429s at 60 concurrent burst** — by configuration, not resource collapse. Revisit before treating 60 VU as a production gate.
2. **Requested “real” endpoints 404 on `HttpApiUrl`** — session lives on `app.rapidcortex.us`; agencies list is `GET /api/agencies`, not `/api/rc-admin/agencies`.
3. **CameraHeartbeat Lambda Errors are already firing** at a steady clip and fail a strict “Lambda errors = 0” gate.

**What does *not* need a production blocker from this run:** DynamoDB throttling, API Gateway 5xx, health-path latency vs the 1000 ms p99 gate, ECS memory/CPU (idle), CloudFront 5xx (idle).

## Artifacts

| File | Contents |
|---|---|
| `results/stress-monitor-dev.log` | 30s CloudWatch monitor (ECS mem + DDB WCU) |
| `results/wave1.json` / `wave2.json` / `wave3.json` | Instrumented wave summaries |
| `results/wave1-smoke.txt` / `wave2-smoke.txt` / `wave3-smoke.txt` | Repo smoke script output |
| `results/endpoint-session.json` / `endpoint-agencies.json` | Step 4 endpoint waves |
| `results/cw-post-wave1.txt` / `cw-post-wave2.txt` / `cw-post-wave3.txt` | CloudWatch snapshots |
| `results/http-load-wave.py` | Instrumented GET runner used for percentiles |
| `results/cw-snapshot.sh` | CloudWatch snapshot helper |
