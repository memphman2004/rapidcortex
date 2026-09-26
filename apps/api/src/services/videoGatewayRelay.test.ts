import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { consumePtzRateLimit, ptzRateLimitKey, resetPtzRateLimitForTests } from "./videoPtzRateLimit.js";
import { signVideoGatewayBody } from "./videoGatewayHmac.js";

describe("NexCort iQ Video PTZ gateway helpers", () => {
  it("signs the relay body with HMAC-SHA256 hex", () => {
    const body = JSON.stringify({ cameraId: "cam-1", command: "Stop" });
    const sig = signVideoGatewayBody("test-secret", body);
    const expected = createHmac("sha256", "test-secret").update(body).digest("hex");
    expect(sig).toBe(expected);
    expect(sig).toHaveLength(64);
  });

  it("rate-limits 60 commands per minute per camera/user", () => {
    resetPtzRateLimitForTests();
    const key = ptzRateLimitKey("agency-a", "user-1", "cam-1");
    const start = 1_000_000;
    for (let i = 0; i < 60; i += 1) {
      expect(consumePtzRateLimit(key, start + i)).toBe(true);
    }
    expect(consumePtzRateLimit(key, start + 60)).toBe(false);
    expect(consumePtzRateLimit(key, start + 60_001)).toBe(true);
  });
});
