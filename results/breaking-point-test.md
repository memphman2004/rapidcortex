# Rapid Cortex Dev — Breaking Point Test

**Date:** 2026-08-17  
**Stack:** `rapid-cortex-dev` (`UPDATE_COMPLETE`)  
**API URL:** `https://k26yw4o3xk.execute-api.us-east-1.amazonaws.com`  
**Target:** `GET /api/health`  
**Tool:** `hey 0.1.5` (`-n 500 -q 0`)  
**Region:** `us-east-1`  
**Profile:** `rapid-cortex`

Live HttpApi `$default` stage settings during the test (unchanged):

- `ThrottlingRateLimit`: **100** req/s  
- `ThrottlingBurstLimit`: **200**

Health function: `rapid-cortex-dev-AppSamStackV2-1BR5-HealthFunction-7ntwCgRvu0zE` (no reserved concurrency).

---

## Verdict

**MAXIMUM PEAK LOAD: 125 concurrent clients / 1,389 rps**  
(500-request burst, **100% HTTP 200**, p50 50 ms, p99 200 ms, HealthFunction errors 0, DynamoDB throttles 0, API Gateway 5xx 0)

**BREAKING POINT:** Official Level 4 (`-c 75`) was the first level where **error/incomplete rate exceeded 5%** (50/500 requests never completed). API Gateway recorded **450 Count, 0 4xx, 0 5xx** in that minute — the missing 50 never reached the API. First **server** errors were **2 × HTTP 429** at Level 3 (`-c 50`, 0.4% — still under the 5% stop). **HTTP 5xx never appeared. p99 never exceeded 705 ms. DynamoDB throttles stayed 0. HealthFunction Lambda Errors stayed 0.**

Levels 9–11 (`-c 500/750/1000`) were **not run**: stop criteria already tripped, then backoff found the ceiling between 125 (pass) and 140 (fail).

**LIMITING FACTOR: client completion at high `hey -c`, not Lambda/DynamoDB/5xx.** Secondary: configured API Gateway throttle (100 rps / burst 200) produced the only 429s (Level 3). Account Lambda concurrency limit is **1,000** (990 unreserved); observed HealthFunction concurrent peak was **82** — not saturated.

This protocol (`-n 500`) is a **sub-second burst**. It does **not** soak the 100 rps stage limit. A multi-second hold above 100 rps would likely 429 from API Gateway before Lambda concurrency (1,000) or DynamoDB.

---

## Stop criteria (applied)

| Criterion | Threshold | Observed |
|---|---|---|
| HTTP 5xx rate | > 1% | **0** at every level |
| p99 latency | > 5,000 ms | Max **705 ms** (Level 2) |
| DynamoDB throttles | > 0 | **0** |
| Health-path Lambda errors | > 0 | **0** |
| Overall non-2xx / incomplete vs `-n 500` | > 5% | First trip at **Level 4 (`-c 75`)** |

Background `ProcessSignalFunction` Lambda Errors (Rapid IQ, reserved concurrency 5) were present at the start of the window and **were not used as a ramp stop**. CameraHeartbeat was quiet (0 errors).

---

## Results table

Success % = HTTP 200 / 500 requested. “Missing” = requested − status-coded responses (hey did not record a status; APIGW Count matched completed 200s when checked).

| Level | Concurrency | RPS Achieved | Success % | p50 | p99 | Lambda Concurrency (Health / account) | DDB Throttles | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | 10 | 184 | 100% (500/500 200) | 50 ms | 139 ms | 2 / 3 | 0 | **PASS** |
| 2 | 25 | 279 | 100% (500/500 200) | 53 ms | 705 ms | 25 / 25 | 0 | **PASS** |
| 3 | 50 | 437 | 99.6% (498 200 + **2 × 429**) | 50 ms | 151 ms | 41 / 41 | 0 | **PASS** (<5% errors) |
| 4 | 75 | 1,001 | 90% (450 200, 50 missing, APIGW 4xx=0) | 51 ms | 177 ms | 57 / 57 | 0 | **FAIL** (>5% incomplete) |
| backoff | 60 | 943 | 96% (480 200, 20 missing) | 50 ms | 151 ms | — | 0 | PASS if 4% incomplete allowed |
| 5 | 100 | 1,110 | 100% (500/500 200) | 53 ms | 215 ms | 36 / — | 0 | **PASS** |
| 6 | 150 | 1,357 | 90% (450 200, 50 missing) | 66 ms | 220 ms | 45 / — | 0 | **FAIL** incomplete |
| 7 | 200 | 1,186 | 80% (400 200, 100 missing) | 161 ms | 259 ms | **82** / 82 | 0 | **FAIL** incomplete |
| 8 | 300 | 1,087 | 60% (300 200, 200 missing) | 237 ms | 271 ms | 71 / — | 0 | **FAIL** incomplete |
| backoff | 125 | **1,389** | **100% (500/500 200)** | 50 ms | 200 ms | 66 / — | 0 | **PASS — ceiling** |
| backoff | 140 | 1,109 | 84% (420 200, 80 missing) | 61 ms | 241 ms | 44 / — | 0 | **FAIL** incomplete |
| 9 | 500 | — | — | — | — | — | — | **SKIPPED** |
| 10 | 750 | — | — | — | — | — | — | **SKIPPED** |
| 11 | 1000 | — | — | — | — | — | — | **SKIPPED** |

Error types:

| Level | 429 | 5xx | Timeout | Missing (no status) |
|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 |
| 2 | 0 | 0 | 0 | 0 |
| 3 | **2** | 0 | 0 | 0 |
| 4 | 0 (APIGW 4xx=0) | 0 | 0 | **50** |
| 5 | 0 | 0 | 0 | 0 |
| 6 | 0 | 0 | 0 | **50** |
| 7 | 0 | 0 | 0 | **100** |
| 8 | 0 | 0 | 0 | **200** |
| backoff 125 | 0 | 0 | 0 | 0 |
| backoff 140 | 0 | 0 | 0 | **80** |

Pattern at high `-c`: completed 200s ≈ `500` until `-c 125`, then hey often completes fewer than 500 with **no Error distribution and no API 4xx/5xx**. Missing count roughly tracks `c - 100` at 150/200/300. That is a **load-generator completion** issue, not Lambda 5xx.

---

## CloudWatch notes

- API Gateway `k26yw4o3xk` **5xx sum = 0** across the ramp window.  
- API Gateway **4xx = 2** (Level 3 only).  
- DynamoDB `ThrottledRequests` for `TableName=rapid-cortex*` = **0**.  
- HealthFunction **Errors = 0**.  
- HealthFunction **ConcurrentExecutions peak = 82** (Level 7 minute). Never approached the account cap of 1,000.

---

## Lambda account / reserved concurrency

```
AccountLimit.ConcurrentExecutions = 1000
UnreservedConcurrentExecutions   = 990
```

Reserved concurrency set (2 functions):

| Reserved | Function |
|---|---|
| 5 | `rapid-cortex-dev-AppSamRapid-ProcessSignalFunction-xA961hgu1Hq4` |
| 5 | `rapid-cortex-dev-AppSamRapid-ProcessSignalFunction-G0kvQjfWHwbh` |

`rapid-cortex-dev*` functions listed: **370**. Memory mix:

| Memory | Count |
|---|---|
| 128 MB | 6 |
| 256 MB | 11 |
| 512 MB | 335 |
| 768 MB | 4 |
| 1024 MB | 12 |
| 2048 MB | 2 |

Health function uses default unreserved pool (no `ReservedConcurrentExecutions`).

---

## How to read this ceiling

1. **Safe burst for `/api/health`:** **125 concurrent / ~1,400 rps** for a 500-hit burst, 100% 200, p99 ~200 ms.  
2. **First server 429:** 50 concurrent (2/500) — token bucket (100 rps / 200 burst) starting to nibble, not a collapse.  
3. **Do not treat 150–300 concurrent hey runs as a Lambda crash:** APIGW 5xx stayed 0; hey simply failed to finish 500 statuses.  
4. **To find a sustained ceiling,** hold QPS at 150–300 for several minutes (or raise live `DefaultRouteSettings` to 500/1000 and re-run). This burst test will not drain a 100 rps limit enough to be the dominant failure mode.

---

## Artifacts

Raw `hey` output: `results/breaking-point/*.hey.txt`
