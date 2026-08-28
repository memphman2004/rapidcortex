import { describe, expect, it } from "vitest";
import {
  LOAD_API_P95_MS,
  LOAD_ERROR_RATE,
  SMOKE_API_P95_MS,
  SMOKE_ERROR_RATE,
  apiP95BudgetMs,
  buildK6Thresholds,
  errorRateBudget,
} from "./k6-thresholds.js";

describe("k6 profile thresholds", () => {
  it("does not apply the 500ms MSA p95 gate or empty Trend metrics on smoke", () => {
    const smoke = buildK6Thresholds("smoke", { hasBearer: false });
    expect(smoke.api_latency_ms).toEqual([`p(95)<${SMOKE_API_P95_MS}`]);
    expect(smoke.http_req_failed).toEqual([`rate<${SMOKE_ERROR_RATE}`]);
    expect(smoke.search_latency_ms).toBeUndefined();
    expect(smoke.transcription_latency_ms).toBeUndefined();
    expect(smoke.page_load_latency_ms).toBeUndefined();
    expect(SMOKE_API_P95_MS).toBeGreaterThan(LOAD_API_P95_MS);
  });

  it("applies search/transcription SLA only when a bearer token will sample them", () => {
    const withoutToken = buildK6Thresholds("load", { hasBearer: false });
    const withToken = buildK6Thresholds("load", { hasBearer: true, hasWeb: true });
    expect(withoutToken.search_latency_ms).toBeUndefined();
    expect(withoutToken.page_load_latency_ms).toBeUndefined();
    expect(withToken.search_latency_ms).toEqual(["p(95)<2000"]);
    expect(withToken.page_load_latency_ms).toEqual(["p(95)<3000"]);
    expect(withToken.api_latency_ms).toEqual([`p(95)<${LOAD_API_P95_MS}`]);
  });

  it("uses a 5s API p95 budget for smoke and 500ms for load", () => {
    expect(apiP95BudgetMs("smoke")).toBe(5000);
    expect(apiP95BudgetMs("load")).toBe(500);
    expect(apiP95BudgetMs("spike")).toBe(2000);
  });

  it("allows 5% errors on smoke/spike and 1% on load", () => {
    expect(errorRateBudget("smoke")).toBe(SMOKE_ERROR_RATE);
    expect(errorRateBudget("spike")).toBe(SMOKE_ERROR_RATE);
    expect(errorRateBudget("load")).toBe(LOAD_ERROR_RATE);
  });
});
