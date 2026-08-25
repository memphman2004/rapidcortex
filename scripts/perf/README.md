# Rapid Cortex performance probes

Read-only concurrent HTTP stress. Complements `scripts/pilot-load-smoke.sh` (health-only curl) with percentiles, multi-stack coverage, and expected-404 handling for undeployed RMS/escalation routes.

```bash
# Conservative prod health baseline (default hosts)
npm run perf:stress

# Staging / custom
WEB_BASE=https://staging.example API_BASE=https://api.staging.example \
  VUS=25 DURATION_S=60 npm run perf:stress

# Authenticated GET /api/me (never enables writes)
STRESS_BEARER_TOKEN=eyJ... npm run perf:stress

# Authenticated writes (refused against prod hosts). Requires a non-prod API_BASE.
STRESS_ALLOW_WRITES=1 STRESS_BEARER_TOKEN=eyJ... \
  WEB_BASE=https://staging.example API_BASE=https://api.staging.example \
  npm run perf:stress

# 45-minute Node soak (ECS memory / Lambda p99 drift)
RC_PROFILE=soak DURATION_S=2700 VUS=10 npm run perf:stress

# k6 soak only (default hold 45m; override with SOAK_HOLD=120m)
RC_PROFILE=soak API_BASE=... WEB_BASE=... BEARER_TOKEN=... \
  bash scripts/run-stress-test.sh staging
```

**Guardrails**
- CAD writeback is never exercised.
- `STRESS_ALLOW_WRITES=1` is refused against `app.` / `api.rapidcortex.us`.
- Keep prod `VUS` modest (≤20). Peak/soak belongs on staging.

**Not covered yet:** WebSocket fan-out, SSE hold times, Dynamo write storms, Claude/Bedrock generate, vendor RMS/CAD APIs.
