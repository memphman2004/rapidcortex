import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  computeRingLinkNonce,
  constantTimeEqual,
  maskEmailForRing,
  validateRingLinkTimestamp,
} from "./ring-nonce.js";

describe("ring-nonce", () => {
  it("computes URL-safe Base64 HMAC without padding", () => {
    const hmacKey = "test-hmac-key";
    const time = "1771130906289";
    const accountId = "acct-123";
    const nonce = computeRingLinkNonce(time, accountId, hmacKey);
    const expected = createHmac("sha256", hmacKey)
      .update(`${time}:${accountId}`, "utf8")
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    expect(nonce).toBe(expected);
    expect(nonce.includes("=")).toBe(false);
    expect(nonce.includes("+")).toBe(false);
    expect(nonce.includes("/")).toBe(false);
  });

  it("validates freshness window", () => {
    const now = Date.now();
    expect(validateRingLinkTimestamp(now).ok).toBe(true);
    expect(validateRingLinkTimestamp(now - 601_000).ok).toBe(false);
    expect(validateRingLinkTimestamp(now + 5_000).ok).toBe(false);
  });

  it("masks emails for account_identifier", () => {
    expect(maskEmailForRing("jeff@example.com")).toBe("j***f@example.com");
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
  });
});
