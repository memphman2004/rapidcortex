import { describe, expect, it } from "vitest";
import type { AccessOverrideRecord } from "../../types/accessOverride.js";

function effective(
  row: Pick<AccessOverrideRecord, "status" | "expiresAt">,
  now: number,
): "active" | "revoked" | "expired" {
  if (row.status === "revoked") return "revoked";
  if (row.expiresAt && Date.parse(row.expiresAt) <= now) return "expired";
  return "active";
}

describe("override effective expiry", () => {
  it("treats past expiresAt as expired even while row status stays active", () => {
    const now = Date.parse("2030-01-01T00:00:00.000Z");
    const row = {
      status: "active" as const,
      expiresAt: "2020-01-01T00:00:00.000Z",
    };
    expect(effective(row, now)).toBe("expired");
  });
});
