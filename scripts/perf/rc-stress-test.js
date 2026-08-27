/**
 * Rapid Cortex — k6 Load Test Script
 *
 * SLA thresholds sourced from MSA Exhibit C §C.5.1 and §8.4.1.
 *
 * Usage:
 *   k6 run --out json=results/k6-raw.json \
 *          -e LOAD_PROFILE=load \
 *          -e API_BASE=https://api.rapidcortex.us \
 *          -e BEARER_TOKEN=eyJ... \
 *          scripts/perf/rc-stress-test.js
 *
 * Prefer: bash scripts/run-k6-profile.sh load
 * (tees results/load-run-<timestamp>.log for the PDF generator)
 *
 * Profiles:  smoke | ramp | load | stress | soak | spike
 * Defaults:  LOAD_PROFILE=smoke, API_BASE=http://localhost:3001
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { apiP95BudgetMs, buildK6Thresholds, errorRateBudget } from "./k6-thresholds.js";

// ── Custom metrics ──────────────────────────────────────────────────────────
const searchLatency   = new Trend("search_latency_ms",        true);
const transcriptLatency = new Trend("transcription_latency_ms", true);
const pageLoadLatency = new Trend("page_load_latency_ms",      true);
const authErrors      = new Counter("auth_errors");
const slaBreaches     = new Counter("sla_breaches");

// ── Environment ─────────────────────────────────────────────────────────────
const API_BASE    = (__ENV.API_BASE    ?? "http://localhost:3001").replace(/\/$/, "");
const WEB_BASE    = (__ENV.WEB_BASE    ?? "http://localhost:3000").replace(/\/$/, "");
const BEARER      = __ENV.BEARER_TOKEN ?? "";
const PROFILE     = __ENV.LOAD_PROFILE ?? "smoke";
const ALLOW_WRITES = __ENV.ALLOW_WRITES === "1" || __ENV.STRESS_ALLOW_WRITES === "1";
const SOAK_HOLD   = __ENV.SOAK_HOLD || "45m";
const STRESS_INCIDENT_ID = __ENV.STRESS_INCIDENT_ID || "stress-probe-incident";

// ── SLA thresholds — MSA Exhibit C §C.5.1 ───────────────────────────────────
//
//   API Response Time:        < 500ms at p95 on load+ (smoke allows 5s for cold start)
//   Page Load Time:           < 3000ms (load+ only; not gated on smoke)
//   Search Results:           < 2000ms (only when BEARER_TOKEN samples the trend)
//   Transcription Latency:    < 2000ms (only when BEARER_TOKEN samples the trend)
//   Error rate:               < 1% load+ / < 5% smoke and spike
//
// NOTE: Per §C.5.1 these are "targets not commitments" for performance metrics.
// Uptime (§C.1.1 / §8.4) is the hard contractual commitment at 99.9%.
// Empty Trend metrics are not thresholded — k6 fails those even when count is 0.
export const thresholds = buildK6Thresholds(PROFILE, { hasBearer: Boolean(BEARER) });

// ── Load profiles ────────────────────────────────────────────────────────────
//
// VU sizing rationale:
//   A mid-size PSAP typically seats 8–20 concurrent dispatchers.
//   Stress target of 50 VUs ≈ 2.5× peak expected production concurrency.
//   Spike target of 100 VUs simulates a mass-casualty event surge.
//
const ALL_PROFILES = {
  // Quick sanity — does it respond at all?
  smoke: {
    vus:      1,
    duration: "30s",
    thresholds,
  },

  // Gradual ramp to baseline — warm-up + stability check
  ramp: {
    stages: [
      { duration: "1m",  target: 10 },   // ramp to baseline concurrency
      { duration: "5m",  target: 10 },   // hold at baseline
      { duration: "30s", target: 0  },   // ramp down
    ],
    thresholds,
  },

  // Sustained normal load — primary readiness gate
  load: {
    stages: [
      { duration: "2m",  target: 25 },   // ramp to expected peak
      { duration: "8m",  target: 25 },   // hold at peak
      { duration: "1m",  target: 0  },   // ramp down
    ],
    thresholds,
  },

  // Beyond-peak stress — where do things degrade?
  stress: {
    stages: [
      { duration: "3m",  target: 50 },   // ramp to 2.5× expected peak
      { duration: "10m", target: 50 },   // sustain
      { duration: "2m",  target: 0  },   // ramp down
    ],
    thresholds,
  },

  // Long-duration soak — memory leaks, connection exhaustion, DynamoDB throttling
  soak: {
    stages: [
      { duration: "2m",  target: 10 },
      { duration: SOAK_HOLD, target: 10 },
      { duration: "2m",  target: 0  },
    ],
    thresholds,
  },

  // Sudden spike — simulates a mass-casualty event surge
  spike: {
    stages: [
      { duration: "30s", target: 0   },  // baseline idle
      { duration: "1m",  target: 100 },  // instant spike to 5× expected peak
      { duration: "2m",  target: 100 },  // hold spike
      { duration: "1m",  target: 10  },  // partial drain
      { duration: "3m",  target: 10  },  // recovery observation
      { duration: "30s", target: 0   },  // ramp down
    ],
    thresholds,
  },
};

// Apply selected profile
export const options = ALL_PROFILES[PROFILE] ?? ALL_PROFILES.smoke;

// ── Shared request parameters ────────────────────────────────────────────────
function authHeaders() {
  const h = { "Content-Type": "application/json" };
  if (BEARER) h["Authorization"] = `Bearer ${BEARER}`;
  return h;
}

// ── Scenario functions ────────────────────────────────────────────────────────

/** Health endpoint — no auth, fastest possible check */
function probeHealth() {
  const res = http.get(`${API_BASE}/api/health`, { tags: { group: "API" } });
  check(res, {
    "health 200": (r) => r.status === 200,
    "health has status field": (r) => {
      try { return JSON.parse(r.body)?.status !== undefined; }
      catch { return false; }
    },
  });
}

/** Auth gate — unauthenticated GET /api/me must return 401 */
function probeAuthGate() {
  const res = http.get(`${API_BASE}/api/me`, { tags: { group: "API" } });
  const ok = check(res, { "anon /api/me → 401": (r) => r.status === 401 });
  if (!ok) authErrors.add(1);
}

/** Authenticated /api/me — validates token is accepted */
function probeAuthMe() {
  if (!BEARER) return;
  const res = http.get(`${API_BASE}/api/me`, {
    headers: authHeaders(),
    tags: { group: "API" },
  });
  const ok = check(res, {
    "auth /api/me → 200": (r) => r.status === 200,
    "me has userId":      (r) => {
      try { return !!JSON.parse(r.body)?.userId; }
      catch { return false; }
    },
  });
  if (!ok) authErrors.add(1);
}

/**
 * CAD active incidents list — tests DynamoDB read path under concurrency.
 * Also records against the search_latency_ms SLA target (§C.5.1 Search: <2000ms).
 */
function probeActiveIncidents() {
  if (!BEARER) return;
  const start = Date.now();
  const res = http.get(`${API_BASE}/api/cad/active-incidents`, {
    headers: authHeaders(),
    tags: { group: "API" },
  });
  searchLatency.add(Date.now() - start);

  const ok = check(res, {
    "active-incidents 200":           (r) => r.status === 200,
    "active-incidents has incidents": (r) => {
      try {
        const j = JSON.parse(r.body);
        return Array.isArray(j?.incidents);
      } catch { return false; }
    },
  });
  if (!ok && res.status >= 500) slaBreaches.add(1);
}

/** CAD health shell — tests Next.js → Lambda adapter path */
function probeCADHealth() {
  const res = http.get(`${WEB_BASE}/api/cad/health`, { tags: { group: "Web" } });
  pageLoadLatency.add(res.timings.duration);
  check(res, { "cad/health 200 or 401": (r) => r.status === 200 || r.status === 401 });
}

/**
 * Translation endpoint — CPU + network bound, tests concurrency resilience.
 * Records against transcription_latency_ms SLA target as the closest proxy
 * (§C.5.1 Transcription Latency: <2000ms).
 */
function probeTranslation() {
  if (!BEARER) return;
  const start = Date.now();
  const res = http.post(
    `${WEB_BASE}/api/language/translate`,
    JSON.stringify({ text: "unit in distress", sourceLang: "en", targetLang: "es" }),
    { headers: authHeaders(), tags: { group: "API" } },
  );
  transcriptLatency.add(Date.now() - start);
  // 200, 401, 403 are all acceptable; 5xx is an SLA breach
  check(res, { "translate non-5xx": (r) => r.status < 500 });
  if (res.status >= 500) slaBreaches.add(1);
}

/** Transcription start — validates Lambda cold start + connection handling */
function probeTranscriptionStart() {
  if (!BEARER) return;
  const start = Date.now();
  const res = http.post(
    `${WEB_BASE}/api/transcription/start`,
    JSON.stringify({ callId: `k6-load-${__VU}-${__ITER}` }),
    { headers: authHeaders(), tags: { group: "API" } },
  );
  transcriptLatency.add(Date.now() - start);
  check(res, { "transcription/start non-5xx": (r) => r.status < 500 });
  if (res.status >= 500) slaBreaches.add(1);
}

function writeOk(res) {
  return res.status < 500;
}

function probeIntakeSession() {
  if (!BEARER || !ALLOW_WRITES) return;
  const res = http.post(
    `${WEB_BASE}/api/intake/session`,
    JSON.stringify({ mode: "stress" }),
    { headers: authHeaders(), tags: { group: "API" } },
  );
  check(res, { "intake_session_write non-5xx": writeOk });
  if (res.status >= 500) slaBreaches.add(1);
}

function probeTranscriptPush() {
  if (!BEARER || !ALLOW_WRITES) return;
  const res = http.post(
    `${API_BASE}/api/incidents/${STRESS_INCIDENT_ID}/transcript`,
    JSON.stringify({ text: "stress-probe", speaker: "caller" }),
    { headers: authHeaders(), tags: { group: "API" } },
  );
  check(res, { "incident_transcript_push non-5xx": writeOk });
  if (res.status >= 500) slaBreaches.add(1);
}

function probeEscalationCreate() {
  if (!BEARER || !ALLOW_WRITES) return;
  const res = http.post(
    `${WEB_BASE}/api/escalations`,
    JSON.stringify({
      incidentId: STRESS_INCIDENT_ID,
      incidentType: "stress-probe",
      incidentDescription: "Authenticated stress-test probe — do not dispatch.",
      incidentLocation: { description: "stress-test" },
      incidentTimeline: [{ at: new Date().toISOString(), event: "stress-probe" }],
    }),
    { headers: authHeaders(), tags: { group: "API" } },
  );
  check(res, { "escalation_create non-5xx": writeOk });
  if (res.status >= 500) slaBreaches.add(1);
}

function probeCadWritebackBlocked() {
  if (!BEARER || !ALLOW_WRITES) return;
  const res = http.post(
    `${API_BASE}/api/security/cad-writeback-blocked`,
    JSON.stringify({ action: "stress-probe" }),
    { headers: authHeaders(), tags: { group: "API" } },
  );
  check(res, { "cad_writeback_blocked non-5xx": writeOk });
  if (res.status >= 500) slaBreaches.add(1);
}

function probeRmsGenerate() {
  if (!BEARER || !ALLOW_WRITES || __ENV.STRESS_ALLOW_AI !== "1") return;
  const res = http.post(
    `${WEB_BASE}/api/rms/reports/generate`,
    JSON.stringify({
      incidentId: STRESS_INCIDENT_ID,
      transcript: "Caller reports a non-emergency stress-probe event.",
      extractedEntities: { incidentType: "other" },
    }),
    { headers: authHeaders(), tags: { group: "API" } },
  );
  check(res, { "rms_generate non-5xx": writeOk });
  if (res.status >= 500) slaBreaches.add(1);
}

// ── Main VU scenario ─────────────────────────────────────────────────────────

export default function () {
  group("Health + Auth", () => {
    probeHealth();
    sleep(0.1);
    probeAuthGate();
    sleep(0.1);
    probeAuthMe();
  });

  sleep(0.5);

  group("API", () => {
    probeActiveIncidents();
    sleep(0.3);
    probeTranslation();
    sleep(0.3);
    probeTranscriptionStart();
    if (ALLOW_WRITES) {
      sleep(0.3);
      probeIntakeSession();
      probeTranscriptPush();
      probeEscalationCreate();
      probeCadWritebackBlocked();
      probeRmsGenerate();
    }
  });

  sleep(0.5);

  group("Web", () => {
    probeCADHealth();
  });

  // Simulate dispatcher think-time between actions
  sleep(Math.random() * 2 + 1); // 1–3 seconds
}

// ── Teardown — summary output for report generator ──────────────────────────

export function handleSummary(data) {
  const profile   = PROFILE;
  const timestamp = new Date().toISOString();
  const p95Budget = apiP95BudgetMs(profile);
  const errBudget = errorRateBudget(profile);
  const apiP95 = data.metrics?.["http_req_duration{group:::API}"]?.values?.["p(95)"] ?? null;
  const pageP95 = data.metrics?.page_load_latency_ms?.values?.["p(95)"] ?? null;
  const searchP95 = data.metrics?.search_latency_ms?.values?.["p(95)"] ?? null;
  const transcP95 = data.metrics?.transcription_latency_ms?.values?.["p(95)"] ?? null;
  const errorRate = data.metrics?.http_req_failed?.values?.rate ?? null;

  const summary = {
    meta: {
      profile,
      timestamp,
      api_base: API_BASE,
      web_base: WEB_BASE,
      vus_max: data.metrics?.vus_max?.values?.max ?? "unknown",
      duration_ms: (data.metrics?.iteration_duration?.values?.avg ?? 0) * (data.metrics?.iterations?.values?.count ?? 0),
    },
    sla: {
      api_p95_ms: apiP95,
      api_p95_pass: apiP95 !== null && apiP95 < p95Budget,
      page_load_p95_ms: pageP95,
      page_load_pass: pageP95 === null || pageP95 < 3000,
      search_p95_ms: searchP95,
      search_pass: searchP95 === null || searchP95 < 2000,
      transcription_p95_ms: transcP95,
      transcription_pass: transcP95 === null || transcP95 < 2000,
      error_rate: errorRate,
      error_rate_pass: errorRate !== null && errorRate < errBudget,
    },
    raw: data,
  };

  const json = JSON.stringify(summary, null, 2);

  return {
    "results/k6-summary.json": json,
    stdout: `\n[RC Stress] Profile: ${profile} | API p95: ${summary.sla.api_p95_ms?.toFixed(0) ?? "—"}ms | Error rate: ${((summary.sla.error_rate ?? 0) * 100).toFixed(2)}%\n`,
  };
}
