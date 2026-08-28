/**
 * Rapid Cortex — k6 Stress Test v2  (2026-08-27 — 403 fix applied)
 *
 * FIX: /api/agencies and /api/integration/status return HTTP 403 for
 * dispatcher-role test accounts. This is correct RBAC behavior, not an
 * infrastructure failure. Per-request http.expectedStatuses() marks 403
 * as acceptable for restricted endpoints so k6 does not count them in
 * http_req_failed. (A global 200–399 range does NOT include 403.)
 *
 * THROTTLE: 500 RPS stage limit / 1000 burst (DefaultRouteSettings)
 *   sustained: 400 rps (80% of limit)
 *   spike:     700 rps (40% above limit, within burst budget)
 *
 * Prefer the Python runner (CloudWatch abort + PDF logs):
 *   python3 scripts/rc-stress-runner.py --api-url https://<id>.execute-api.us-east-1.amazonaws.com
 *
 * Direct:
 *   k6 run -e API_URL=https://... -e BEARER_TOKEN=... scripts/perf/rc-stress-v2.js
 *
 * Do not point this at api.rapidcortex.us unless RC_ALLOW_PROD_STRESS=1
 * (enforced by rc-stress-runner.py).
 */

import http from "k6/http";
import { check } from "k6";
import { Trend, Counter } from "k6/metrics";

const healthLatency = new Trend("health_latency", true);
const agencyLatency = new Trend("agency_latency", true);
const meLatency = new Trend("me_latency", true);
const serverErrors = new Counter("server_errors");
const authErrors = new Counter("auth_errors");

const BASE_URL = (__ENV.API_URL || __ENV.API_BASE || "").replace(/\/$/, "");
const TOKEN = __ENV.BEARER_TOKEN || "";
const RESULTS_DIR = (__ENV.RESULTS_DIR || "results/stress-v2").replace(/\/$/, "");

if (!BASE_URL) {
  throw new Error("API_URL (or API_BASE) is required.");
}

const thresholds = {
  "http_req_failed{scenario:sustained}": ["rate<0.02"],
  "http_req_duration{scenario:sustained}": ["p(99)<500"],
  "http_req_failed{scenario:spike}": ["rate<0.60"],
  server_errors: ["count<1"],
  health_latency: ["p(99)<200"],
};
if (TOKEN) {
  thresholds.agency_latency = ["p(99)<600"];
  thresholds.me_latency = ["p(99)<400"];
}

export const options = {
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  scenarios: {
    sustained: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 300,
      maxVUs: 600,
      stages: [
        { target: 50, duration: "30s" },
        { target: 200, duration: "2m" },
        { target: 400, duration: "2m" },
        { target: 400, duration: "10m" },
        { target: 0, duration: "30s" },
      ],
      exec: "sustainedLoad",
    },
    spike: {
      executor: "ramping-arrival-rate",
      startRate: 0,
      timeUnit: "1s",
      preAllocatedVUs: 550,
      maxVUs: 900,
      startTime: "15m30s",
      stages: [
        { target: 700, duration: "30s" },
        { target: 700, duration: "2m" },
        { target: 0, duration: "30s" },
      ],
      exec: "spikeLoad",
    },
  },
  thresholds,
};

const openHeaders = { "Content-Type": "application/json" };
const authHeaders = TOKEN
  ? { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }
  : openHeaders;

// restricted: true → dispatcher 403 is correct RBAC, not http_req_failed.
const ENDPOINTS = TOKEN
  ? [
      {
        path: "/api/health",
        headers: openHeaders,
        weight: 0.43,
        trend: healthLatency,
        restricted: false,
      },
      {
        path: "/api/agencies",
        headers: authHeaders,
        weight: 0.28,
        trend: agencyLatency,
        restricted: true,
      },
      {
        path: "/api/me",
        headers: authHeaders,
        weight: 0.15,
        trend: meLatency,
        restricted: false,
      },
      {
        path: "/api/integration/status",
        headers: authHeaders,
        weight: 0.14,
        trend: null,
        restricted: true,
      },
    ]
  : [
      {
        path: "/api/health",
        headers: openHeaders,
        weight: 1,
        trend: healthLatency,
        restricted: false,
      },
    ];

function pickEndpoint() {
  const r = Math.random();
  let cum = 0;
  for (const ep of ENDPOINTS) {
    cum += ep.weight;
    if (r < cum) return ep;
  }
  return ENDPOINTS[ENDPOINTS.length - 1];
}

function recordResult(res, ep) {
  if (res.status >= 500) {
    serverErrors.add(1, { path: res.url });
  }
  if (res.status === 401) {
    authErrors.add(1, { path: res.url });
  }
  if (ep.trend) {
    ep.trend.add(res.timings.duration);
  }
}

export function sustainedLoad() {
  const ep = pickEndpoint();
  const params = {
    headers: ep.headers,
    ...(ep.restricted
      ? { responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 403) }
      : {}),
  };

  const res = http.get(`${BASE_URL}${ep.path}`, params);

  check(res, {
    [`${ep.path} 2xx${ep.restricted ? " or 403" : ""}`]: (r) =>
      ep.restricted
        ? (r.status >= 200 && r.status < 300) || r.status === 403
        : r.status >= 200 && r.status < 300,
  });

  recordResult(res, ep);
}

/** Health-only spike. 429s from the stage throttle are expected; do not mix into health p99. */
export function spikeLoad() {
  const res = http.get(`${BASE_URL}/api/health`, {
    headers: openHeaders,
    responseCallback: http.expectedStatuses(200, 429),
  });
  check(res, { "spike: 200 or 429": (r) => r.status === 200 || r.status === 429 });
  recordResult(res, { trend: null, restricted: false });
}

export function handleSummary(data) {
  const m = data.metrics;
  const get = (metric, stat, def = 0) => m[metric]?.values?.[stat] ?? def;

  const totalReqs = get("http_reqs", "count");
  const failRate = get("http_req_failed", "rate") * 100;
  const p50 = get("http_req_duration", "p(50)");
  const p99 = get("http_req_duration", "p(99)");
  const svrErrors = get("server_errors", "count");
  const authErr = get("auth_errors", "count");
  const healthP99 = get("health_latency", "p(99)");
  const agencyP99 = get("agency_latency", "p(99)");
  const meP99 = get("me_latency", "p(99)");

  const breaches = Object.entries(m)
    .filter(
      ([, mv]) =>
        mv?.thresholds && Object.values(mv.thresholds).some((t) => t.ok === false),
    )
    .map(([name]) => name);

  const verdict =
    svrErrors > 0
      ? "FAIL — 5xx server errors"
      : breaches.length > 0
        ? `FAIL — ${breaches.join(", ")}`
        : "PASS";

  const lines = [
    "",
    "╔══════════════════════════════════════════════════════╗",
    "║  Rapid Cortex Stress Test v2 — k6 Summary           ║",
    "║  500 RPS stage throttle / 1000 burst                ║",
    "╚══════════════════════════════════════════════════════╝",
    `  Verdict          : ${verdict}`,
    `  Total requests   : ${totalReqs}`,
    `  Failure rate     : ${failRate.toFixed(2)}%`,
    `  p50 / p99        : ${p50.toFixed(0)}ms / ${p99.toFixed(0)}ms`,
    "",
    "  Per-endpoint p99 (sustained):",
    `    /api/health             ${healthP99.toFixed(0)}ms   SLA <200ms`,
    `    /api/agencies           ${agencyP99.toFixed(0)}ms   SLA <600ms  (403=RBAC ok)`,
    `    /api/me                 ${meP99.toFixed(0)}ms   SLA <400ms`,
    "",
    `  Server errors (5xx) : ${svrErrors}   ← must be 0`,
    `  Auth errors (401)   : ${authErr}   ← non-zero = token expired`,
    "",
    breaches.length > 0
      ? `  THRESHOLD BREACHES:\n${breaches.map((b) => `    ✗ ${b}`).join("\n")}`
      : "  All thresholds : ✓ PASS",
    "═══════════════════════════════════════════════════════",
    "",
  ].join("\n");

  return {
    [`${RESULTS_DIR}/k6-summary.json`]: JSON.stringify(data, null, 2),
    stdout: lines,
  };
}
