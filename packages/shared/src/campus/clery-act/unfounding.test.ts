import { describe, expect, it } from "vitest";
import { canUnfoundCrime } from "./unfounding.js";
import type { CampusSecurityAuthority } from "./schemas.js";

function csa(over: Partial<CampusSecurityAuthority> = {}): CampusSecurityAuthority {
  return {
    agencyId: "campus-uga",
    userId: "u1",
    displayName: "Officer Lee",
    email: "lee@example.edu",
    reporterType: "SWORN_OFFICER",
    isSwornOfficer: true,
    badgeNumber: "12345",
    isCleryCoordinator: false,
    activeFrom: "2020-01-01T00:00:00.000Z",
    addedBy: "admin",
    addedAt: "2020-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("canUnfoundCrime", () => {
  it("allows only sworn officers with a badge number on file", () => {
    expect(canUnfoundCrime(csa())).toBe(true);
  });

  it("denies campus administrators who are not sworn CSAs", () => {
    expect(canUnfoundCrime(null)).toBe(false);
    expect(
      canUnfoundCrime(
        csa({
          reporterType: "DESIGNATED_OFFICIAL",
          isSwornOfficer: false,
          badgeNumber: undefined,
          isCleryCoordinator: true,
        }),
      ),
    ).toBe(false);
  });

  it("denies sworn flag without badge number", () => {
    expect(canUnfoundCrime(csa({ badgeNumber: "  " }))).toBe(false);
    expect(canUnfoundCrime(csa({ badgeNumber: undefined }))).toBe(false);
  });

  it("denies inactive CSA records", () => {
    expect(canUnfoundCrime(csa({ activeTo: "2024-01-01T00:00:00.000Z" }), new Date("2026-01-01"))).toBe(
      false,
    );
  });
});
