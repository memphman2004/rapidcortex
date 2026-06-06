import { describe, expect, it } from "vitest";
import { isLikelyPublicAccessToken } from "./publicToken.js";

describe("isLikelyPublicAccessToken", () => {
  it("rejects missing or short tokens", () => {
    expect(isLikelyPublicAccessToken(undefined)).toBe(false);
    expect(isLikelyPublicAccessToken("")).toBe(false);
    expect(isLikelyPublicAccessToken("short_token")).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(isLikelyPublicAccessToken("invalid token with spaces")).toBe(false);
    expect(isLikelyPublicAccessToken("token$with$symbols")).toBe(false);
  });

  it("accepts url-safe opaque tokens", () => {
    expect(isLikelyPublicAccessToken("abcDEF0123_-abcDEF0123")).toBe(true);
  });
});
