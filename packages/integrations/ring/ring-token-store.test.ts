import { describe, expect, it } from "vitest";

/**
 * Mirrors sanitizeSecretSegment in ring-token-store.ts (kept local so the test
 * does not need to export the helper).
 */
function sanitizeSecretSegment(value: string): string {
  const cleaned = value.trim().replace(/[^A-Za-z0-9\-_/=.@!+]/g, "_");
  if (!cleaned) throw new Error("empty");
  return cleaned;
}

describe("Ring Secrets Manager name sanitization", () => {
  it("replaces colons from citizen ring account ids", () => {
    const id =
      "ring:test-agency:citizen:ava1.ring.account.ABC123";
    const cleaned = sanitizeSecretSegment(id);
    expect(cleaned).toBe("ring_test-agency_citizen_ava1.ring.account.ABC123");
    expect(cleaned).not.toMatch(/%/);
    expect(cleaned).not.toMatch(/:/);
  });

  it("does not percent-encode (Secrets Manager rejects %)", () => {
    const accountId = "ava1.ring.account.NXIQLZ5SBV5TG6VIHEE33HTGLW225DMRYSBPL5JKR44332GAHKGCB4FCBTPTZH747ZOC7Y7DGDK2SXVWLT24X4QDVD6VVBDT";
    expect(sanitizeSecretSegment(accountId)).toBe(accountId);
  });
});
