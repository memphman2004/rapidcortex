import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyS256CodeChallenge } from "./pkce.js";

describe("verifyS256CodeChallenge", () => {
  it("accepts matching verifier", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(verifyS256CodeChallenge(verifier, challenge)).toBe(true);
  });

  it("rejects mismatch", () => {
    expect(verifyS256CodeChallenge("abc", "xyz")).toBe(false);
  });
});
