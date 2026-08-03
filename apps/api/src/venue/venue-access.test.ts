import { describe, expect, it } from "vitest";
import { canAccessVenueTenant, venueCodeFromAgencyId } from "./venue-access";

describe("venueCodeFromAgencyId", () => {
  it("extracts codes from test-, last-, and plain venue agency ids", () => {
    expect(venueCodeFromAgencyId("test-venue-acme")).toBe("ACME");
    expect(venueCodeFromAgencyId("last-venue-acme")).toBe("ACME");
    expect(venueCodeFromAgencyId("venue-acme-arena")).toBe("ACMEARENA");
  });
});

describe("canAccessVenueTenant", () => {
  it("allows venue admins for matching org codes including last-venue-*", () => {
    expect(
      canAccessVenueTenant(
        { userId: "u1", agencyId: "last-venue-acme", role: "venue_admin", email: "a@b.c" },
        "ACME",
      ),
    ).toBe(true);
  });

  it("denies mismatched venue codes", () => {
    expect(
      canAccessVenueTenant(
        { userId: "u1", agencyId: "last-venue-acme", role: "venue_admin", email: "a@b.c" },
        "OTHER",
      ),
    ).toBe(false);
  });
});
