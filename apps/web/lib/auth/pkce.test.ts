import { describe, expect, it } from "vitest";
import {
  base64UrlEncode,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "@/lib/auth/pkce";

describe("pkce utilities", () => {
  it("generates URL-safe verifier", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThan(40);
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("generates deterministic S256 challenge for verifier", () => {
    const challenge = generateCodeChallenge("test-verifier");
    expect(challenge).toBe("JBbiqONGWPaAmwXk_8bT6UnlPfrn65D32eZlJS-zGG0");
  });

  it("generates random state", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it("base64url encodes without padding", () => {
    expect(base64UrlEncode(Buffer.from("abc"))).toBe("YWJj");
  });
});
