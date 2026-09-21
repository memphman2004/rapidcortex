import { describe, expect, it } from "vitest";
import { resolveStaffGuideHref } from "./href";

describe("resolveStaffGuideHref", () => {
  it("returns null for 911 PSAP roles so they keep the Help tab", () => {
    expect(resolveStaffGuideHref({ role: "dispatcher", pathname: "/example-city/dashboard" })).toBeNull();
    expect(resolveStaffGuideHref({ role: "agencyadmin", pathname: "/example-city/admin" })).toBeNull();
  });

  it("builds console Staff Guide URLs for campus, venue, and transit", () => {
    expect(
      resolveStaffGuideHref({
        role: "CAMPUS_SECURITY",
        pathname: "/app/campus/LINCOLNHIGH/incidents",
      }),
    ).toBe("/app/campus/LINCOLNHIGH/staff-guide");
    expect(
      resolveStaffGuideHref({
        role: "VENUE_ADMIN",
        agencyId: "venue-MBS",
      }),
    ).toBe("/app/venue/MBS/staff-guide");
    expect(
      resolveStaffGuideHref({
        role: "TRANSIT_SUPERVISOR",
        pathname: "/app/transit/admin",
        agencyId: "transit-HVT",
      }),
    ).toBe("/transit/HVT/staff-guide");
  });
});
