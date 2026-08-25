import { describe, expect, it } from "vitest";
import { normalizeRingReturnUrl } from "./ring-oauth.js";

describe("normalizeRingReturnUrl", () => {
  it("accepts Ring HTTPS Appstore return URLs", () => {
    expect(normalizeRingReturnUrl("https://oauth.ring.com/appstore/complete?ok=1")).toBe(
      "https://oauth.ring.com/appstore/complete?ok=1",
    );
    expect(normalizeRingReturnUrl("https://ring.com/oauth/done")).toContain("https://ring.com/");
  });

  it("accepts native Appstore callback schemes", () => {
    expect(normalizeRingReturnUrl("ring://oauth-complete?status=success")).toBe(
      "ring://oauth-complete?status=success",
    );
    expect(normalizeRingReturnUrl("amazonstores://appstore/oauth/return")).toBe(
      "amazonstores://appstore/oauth/return",
    );
    expect(normalizeRingReturnUrl("alexa://amzn1.skill.ring/oauth")).toBe(
      "alexa://amzn1.skill.ring/oauth",
    );
  });

  it("rejects non-Ring HTTPS hosts and unsafe schemes", () => {
    expect(normalizeRingReturnUrl("https://evil.example/phish")).toBeNull();
    expect(normalizeRingReturnUrl("http://oauth.ring.com/appstore/complete")).toBeNull();
    expect(normalizeRingReturnUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeRingReturnUrl("")).toBeNull();
    expect(normalizeRingReturnUrl(null)).toBeNull();
  });
});
