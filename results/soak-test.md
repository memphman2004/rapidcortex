# Rapid Cortex Dev — 60-Minute Soak Test

**Date:** 2026-08-17  
**Stack:** `rapid-cortex-dev`  
**API URL:** `https://k26yw4o3xk.execute-api.us-east-1.amazonaws.com`  
**HttpApiId:** `k26yw4o3xk`  
**Target:** `GET /api/health`  
**Derived soak concurrency:** 70% × last passing burst level **125** = **88**  
**Command:** `hey -z 3600s -c 88 -q 0`  
**Window (UTC):** 13:23:28Z → 14:23:28Z (hey); monitors through 14:25:25Z  
**Live stage throttle (unchanged):** 100 req/s, burst 200

ECS metrics use the real SSR cluster `rapid-cortex-v2-web-prod` (there is no `rapid-cortex-dev-cluster`). This soak hits execute-api Lambda, not ECS.

---

## Verdict

**MAXIMUM CONTINUOUS LOAD: not 88 concurrent.** Offered load was **~2,460 rps** at 88 workers. Successful **HTTP 200** throughput was **~11.2 rps** (40,324 / 3,600 s). The live HttpApi cap is **100 rps**; a 429 flood from unlimited workers **did not fully utilize** that 100 rps budget (token-bucket under saturation).

**DEGRADATION OBSERVED: No** (for Lambda/DDB/5xx/latency). **Yes** for availability of 2xx — **immediate** API Gateway 429s from T+0, stable for 60 minutes (not a slow leak).

**DEGRADATION TYPE: none** for latency drift, error accumulation (5xx), memory, or hung Lambdas. **Throttle saturation** from the first interval.

**HOURS TO DEGRADATION: 0** — 429s from the first 5-minute window. No further worsening through T+60m.

**LIMITING FACTOR: API Gateway `$default` throttle (100 rps / burst 200).** Not Lambda concurrency (peak 79 vs account 1,000), not DynamoDB, not ECS, not 5xx.

**RECOMMENDED PRODUCTION LIMIT: 80 rps sustained (20% headroom under the live 100 rps cap), with client-side rate limiting.** Do **not** size production on burst concurrency (125) or 70% of that (88 unthrottled workers). At ~50 ms health latency, 80 rps needs only on the order of **4–10 concurrent** rate-limited clients. Raise live `DefaultRouteSettings` to 500/1000 (already in SAM, not deployed) before treating 88 concurrent as a continuous target.

---

## hey summary (`results/soak-raw.txt`)

| Metric | Value |
|---|---|
| Duration | 3,600.03 s |
| Offered RPS | **2,460** |
| HTTP 200 | **40,324** (4.03%) |
| HTTP 429 | **959,676** (95.97%) |
| HTTP 5xx | **0** |
| p50 | 34.7 ms |
| p99 | 51.4 ms |
| Average | 316.8 ms (pulled up by 429 wait) |

---

## Interval table (CloudWatch, ~6-minute overlapping windows)

API p99 = API Gateway `Latency` extended p99 (ms). Lambda concurrency = HealthFunction Maximum. ECS CPU = `rapid-cortex-v2-web-prod` Maximum %. Sample = 30 live GETs during the poll (hey does not print until exit).

| Interval | Time (UTC) | API p99 | Lambda Errors (Health) | Lambda Concurrency max | DDB Throttles | ECS CPU max | Notes |
|---|---|---|---|---|---|---|---|
| 1 | T+5m 13:28 | 16.2 ms | 0 | 59 | 0 | 1.04% | APIGW 4xx 89,891 / count 93,436; sample 3% 200 |
| 2 | T+10m 13:33 | 17.0 ms | 0 | 61 | 0 | 1.09% | 4xx 101,129; sample 7% 200 |
| 3 | T+15m 13:38 | 16.7 ms | 0 | 62 | 0 | 1.03% | 4xx 121,874; sample 0% 200 |
| 4 | T+20m 13:43 | 16.7 ms | 0 | 51 | 0 | 0.98% | 4xx 133,314; sample 3% 200 |
| 5 | T+25m 13:49 | 17.3 ms | 0 | 54 | 0 | 1.12% | 4xx 52,764; sample 10% 200 |
| 6 | T+30m 13:54 | 16.9 ms | 0 | 54 | 0 | 1.10% | 4xx 81,322; sample 10% 200 |
| 7 | T+35m 13:59 | 17.1 ms | 0 | 72 | 0 | 4.73% | 4xx 81,391; sample 7% 200 |
| 8 | T+40m 14:04 | 17.5 ms | 0 | **79** | 0 | 1.03% | 4xx 98,920; sample 7% 200 |
| 9 | T+45m 14:09 | 16.9 ms | 0 | 57 | 0 | 1.05% | 4xx 118,806; sample 7% 200 |
| 10 | T+50m 14:14 | 16.5 ms | 0 | 78 | 0 | 1.76% | 4xx 132,800; sample 7% 200 |
| 11 | T+55m 14:20 | 16.9 ms | 0 | 52 | 0 | 1.22% | 4xx ≈ count (period overlap); sample 3% 200 |
| 12 | T+62m 14:25 | 17.0 ms | 0 | 66 | 0 | 1.27% | hey already exited; sample **100% 200**; 4xx 630k in a wide leftover window |

API Gateway **5xx = 0** every interval. HealthFunction **Errors = 0**. DynamoDB **ThrottledRequests = 0**. Background Rapid IQ `ProcessSignalFunction` errors (~3/window) are unrelated.

---

## Degradation analysis

| Question | Answer |
|---|---|
| Interval 1 p99 vs Interval 12 p99 | **16.2 ms → 17.0 ms** (no meaningful drift) |
| Latency drift over time? | **No.** APIGW p99 stayed 16.2–17.5 ms for 60 minutes. |
| Error rate increase over time? | **No 5xx.** 429 rate was **high from interval 1** (~96% of APIGW Count) and stayed high. Not a slow leak. |
| Lambda concurrency unbounded / hung? | **No.** Health max 51–79, avg ~20. Account cap 1,000 unused. |
| DynamoDB throttles after sustained load? | **None.** Health path barely touches DDB. |
| ECS memory leak? | **No.** Memory ~11.0–11.2% flat. CPU idle (~1%; 4.7% blip at T+35). Soak did not hit ECS. |

Interval 12 sample flipped to 100% 200 because `hey` had already finished (`-z 3600s` ended ~14:23Z). That is recovery after load, not a mid-soak improvement.

---

## Interpretation

Burst test (`-n 500`) at 125 concurrent can complete before the 100 rps stage limit matters. Soak at **88 unthrottled workers** offers ~2,500 rps for an hour and is **immediately 429-bound**.

Successful 200s (~11 rps) are **below** the configured 100 rps cap because a saturated client hammering 429s does not behave like a well-paced 100 rps producer. Production traffic should be **rate-limited to ≤80 rps**, not sized at 88 concurrent with `-q 0`.

To re-soak after deploying SAM `ThrottlingRateLimit: 500` / `Burst: 1000`, hold **~350 rps** (70% of 500) for 60 minutes with `hey -z 3600s -c N -q <per-worker QPS>` so offered load matches the new cap.

---

## Artifacts

- `results/soak-raw.txt` — hey summary  
- `results/soak-intervals.json` — 12 CloudWatch + sample snapshots  
- `results/soak-summary.json` — run metadata  
- `results/run-soak.py` — monitor script  
