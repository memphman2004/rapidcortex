/**
 * Rate and abuse-adjacent behavior (CJIS / availability):
 * - `PublicBurstLimiter` enforces a fixed burst per key (e.g. opaque token) within a time window
 *   at Lambda process scope; pair with API Gateway throttling, WAF, and usage plans in production.
 * - Token-oriented abuse: repeated public requests after a row is in `uploaded` / expired state
 *   should be rejected (see token-abuse tests for 409/410).
 * - Distributed or cross-region abuse: detect via CloudWatch + alarms on 4xx/5xx and unique token hashes;
 *   automated “alert on shared token” is a metric/ops concern — not unit-tested here.
 */
import { describe, expect, it } from "vitest";
import { PublicBurstLimiter } from "../../lib/publicRateLimiter.js";

describe("public burst limiter (abuse backpressure)", () => {
  it("denies the N+1 request within a sliding window for the same key", () => {
    const max = 5;
    const windowMs = 60_000;
    const limiter = new PublicBurstLimiter(max, windowMs);
    const t0 = 1_700_000_000_000;
    const key = "opaquePublicToken:abc123def456";
    for (let i = 0; i < max; i += 1) {
      expect(limiter.allow(key, t0 + i)).toBe(true);
    }
    expect(limiter.allow(key, t0 + max)).toBe(false);
  });

  it("treats different keys as independent buckets (no cross-tenant interference)", () => {
    const limiter = new PublicBurstLimiter(2, 10_000);
    const t = 1_800_000_000_000;
    expect(limiter.allow("k-a", t)).toBe(true);
    expect(limiter.allow("k-a", t + 1)).toBe(true);
    expect(limiter.allow("k-a", t + 2)).toBe(false);
    expect(limiter.allow("k-b", t + 2)).toBe(true);
  });
});
