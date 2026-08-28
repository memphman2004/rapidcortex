/**
 * k6 threshold sets for Rapid Cortex load profiles.
 *
 * Smoke is a connectivity gate (cold Lambda starts are expected).
 * Load+ profiles apply MSA Exhibit C §C.5.1 latency targets.
 *
 * Custom Trend metrics must not be thresholded unless the VU always samples
 * them — k6 fails empty-metric thresholds (count 0) even when the app is healthy.
 */

export const SMOKE_API_P95_MS = 5000;
export const LOAD_API_P95_MS = 500;
export const SMOKE_ERROR_RATE = 0.05;
export const LOAD_ERROR_RATE = 0.01;
export const SPIKE_ERROR_RATE = 0.05;

/**
 * Use api_latency_ms (explicit Trend) rather than http_req_duration{group:::API}.
 * k6's reserved `group` tag is overwritten by group() names, so Health + Auth
 * probes never land in group:::API — and without a bearer the API group is empty.
 *
 * @param {string} profile
 * @param {{ hasBearer?: boolean, hasWeb?: boolean }} [opts]
 * @returns {Record<string, string[]>}
 */
export function buildK6Thresholds(profile, opts = {}) {
  const hasBearer = Boolean(opts.hasBearer);
  const hasWeb = Boolean(opts.hasWeb);
  const isSmoke = profile === "smoke";
  const isSpike = profile === "spike";

  /** @type {Record<string, string[]>} */
  const thresholds = {
    http_req_failed: [`rate<${errorRateBudget(profile)}`],
    api_latency_ms: [`p(95)<${apiP95BudgetMs(profile)}`],
  };

  if (isSmoke) {
    return thresholds;
  }

  if (isSpike) {
    thresholds.auth_errors = ["count<5"];
    return thresholds;
  }

  thresholds.auth_errors = ["count<5"];
  if (hasWeb) {
    thresholds.page_load_latency_ms = ["p(95)<3000"];
  }
  if (hasBearer) {
    thresholds.search_latency_ms = ["p(95)<2000"];
    thresholds.transcription_latency_ms = ["p(95)<2000"];
  }
  return thresholds;
}

export function apiP95BudgetMs(profile) {
  if (profile === "smoke") return SMOKE_API_P95_MS;
  if (profile === "spike") return 2000;
  return LOAD_API_P95_MS;
}

export function errorRateBudget(profile) {
  if (profile === "smoke") return SMOKE_ERROR_RATE;
  if (profile === "spike") return SPIKE_ERROR_RATE;
  return LOAD_ERROR_RATE;
}
