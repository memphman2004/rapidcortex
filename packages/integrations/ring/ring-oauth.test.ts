import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RING_OAUTH_AUTHORIZE_URL } from "./ring-env.js";
import { RingOAuthService, normalizeRingReturnUrl } from "./ring-oauth.js";

vi.mock("./ring-credentials.js", () => ({
  getRingCredentials: vi.fn(async () => ({
    clientId: "RapidCortexConnect_test",
    clientSecret: "test-secret",
    hmacKey: "test-hmac",
  })),
}));

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

describe("RingOAuthService partner-initiated authorize URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omits scope so Ring uses portal-approved app scopes — not scope=client", async () => {
    const oauth = new RingOAuthService();
    const { url, state, codeVerifier } = await oauth.buildAuthorizationUrl("test-agency", "user-1");
    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(RING_OAUTH_AUTHORIZE_URL);
    expect(parsed.searchParams.get("scope")).toBeNull();
    expect(parsed.searchParams.has("scope")).toBe(false);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(url.includes("scope=client")).toBe(false);
    expect(url.includes("oauth.ring.com/oauth/authorize")).toBe(false);

    const challenge = parsed.searchParams.get("code_challenge");
    expect(challenge).toBeTruthy();
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    const expected = createHash("sha256").update(codeVerifier).digest("base64url");
    expect(challenge).toBe(expected);
  });

  it("does not put the PKCE verifier on the authorize URL", async () => {
    const oauth = new RingOAuthService();
    const { url, codeVerifier } = await oauth.buildCitizenAuthorizationUrl("test-agency");
    expect(url.includes(codeVerifier)).toBe(false);
    expect(new URL(url).searchParams.has("scope")).toBe(false);
  });
});
