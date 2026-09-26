import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { newGuestAssistSessionId, signGuestAssistToken, verifyGuestAssistToken } from "./token";

describe("guest-assist token", () => {
  it("round-trips a signed session token", () => {
    const secret = "test-secret";
    const payload = {
      sid: newGuestAssistSessionId(),
      v: "venue" as const,
      loc: "Section 112",
      name: "Stadium Assist",
      agencyId: "agency-1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = signGuestAssistToken(payload, secret);
    expect(verifyGuestAssistToken(token, secret)?.sid).toBe(payload.sid);
    expect(verifyGuestAssistToken(token, "other")).toBeNull();
    expect(createHmac("sha256", secret).digest("hex").length).toBeGreaterThan(8);
  });

  it("rejects expired tokens", () => {
    const token = signGuestAssistToken(
      {
        sid: "s1",
        v: "campus",
        loc: "Quad",
        name: "Campus",
        agencyId: "",
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      "s",
    );
    expect(verifyGuestAssistToken(token, "s")).toBeNull();
  });
});
