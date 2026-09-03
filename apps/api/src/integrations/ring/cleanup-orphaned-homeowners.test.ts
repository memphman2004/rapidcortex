import { describe, expect, it } from "vitest";
import { isOrphan } from "./cleanup-orphaned-homeowners.js";

describe("orphan homeowner detection", () => {
  const cutoff = "2026-09-01T00:00:00.000Z";

  it("flags accounts with no devices older than 48h that are not ACTIVE", () => {
    expect(
      isOrphan(
        {
          deviceCount: 0,
          deviceIds: [],
          registeredAt: "2026-08-01T00:00:00.000Z",
          status: "PENDING",
          consentGiven: false,
        },
        cutoff,
      ),
    ).toBe(true);
  });

  it("keeps ACTIVE accounts and accounts with devices", () => {
    expect(
      isOrphan(
        {
          deviceCount: 0,
          deviceIds: [],
          registeredAt: "2026-08-01T00:00:00.000Z",
          status: "ACTIVE",
          consentGiven: true,
        },
        cutoff,
      ),
    ).toBe(false);
    expect(
      isOrphan(
        {
          deviceCount: 2,
          deviceIds: ["a", "b"],
          registeredAt: "2026-08-01T00:00:00.000Z",
          status: "PENDING",
          consentGiven: true,
        },
        cutoff,
      ),
    ).toBe(false);
    expect(
      isOrphan(
        {
          deviceCount: 0,
          deviceIds: [],
          registeredAt: "2026-09-01T12:00:00.000Z",
          status: "PENDING",
          consentGiven: false,
        },
        cutoff,
      ),
    ).toBe(false);
  });
});
