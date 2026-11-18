import { describe, expect, it } from "vitest";
import { createDemoTokenClaims, signDemoToken } from "../../../../web/src/demo/tokens/demo-token";
import { verifyDemoTokenNode } from "./demoTokens";

describe("demo token lambda matches the web signer", () => {
  it("verifies a web-signed token and rejects a tampered one", async () => {
    const secret = "cross-runtime-secret";
    const claims = createDemoTokenClaims({
      scenarioId: "demo-standard",
      issuer: "sales-desk",
      now: 1_800_000_000,
      jti: "cross-1",
      expiresInSeconds: 30,
    });
    const token = await signDemoToken(claims, secret);
    expect(verifyDemoTokenNode(token, secret, 1_800_000_000).ok).toBe(true);
    expect(verifyDemoTokenNode(`${token}x`, secret, 1_800_000_000)).toEqual({ ok: false, reason: "invalid" });
  });
});
