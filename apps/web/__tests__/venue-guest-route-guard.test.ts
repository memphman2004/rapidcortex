import { describe, expect, it } from "vitest";
import { dashboardRouteFromRole, pathMatchesRoleDashboard } from "rapid-cortex-shared";
import { isVenueGuestServicesRole } from "@/lib/venue/venue-guest-services";

describe("venue guest services route guards", () => {
  const agencyId = "test-venue-mbs";
  const home = dashboardRouteFromRole("venue_guest", agencyId);

  it("recognizes guest-services role aliases", () => {
    expect(isVenueGuestServicesRole("venue_guest")).toBe(true);
    expect(isVenueGuestServicesRole("VENUE_GUEST_SERVICES")).toBe(true);
  });

  it("allows widget home only — blocks direct /reports navigation", () => {
    expect(pathMatchesRoleDashboard(home, "venue_guest", agencyId)).toBe(true);
    expect(pathMatchesRoleDashboard(`${home}/`, "venue_guest", agencyId)).toBe(true);
    expect(pathMatchesRoleDashboard("/venue/MBS", "venue_guest", agencyId)).toBe(true);
    expect(pathMatchesRoleDashboard("/venue/MBS/", "venue_guest", agencyId)).toBe(true);

    expect(pathMatchesRoleDashboard("/app/venue/MBS/reports", "venue_guest", agencyId)).toBe(false);
    expect(pathMatchesRoleDashboard("/venue/MBS/reports", "venue_guest", agencyId)).toBe(false);
    expect(pathMatchesRoleDashboard("/app/venue/MBS/incidents", "venue_guest", agencyId)).toBe(false);
    expect(pathMatchesRoleDashboard("/app/venue/MBS/settings", "venue_guest", agencyId)).toBe(false);
  });

  it("still allows venue supervisor to reach reports", () => {
    expect(pathMatchesRoleDashboard("/app/venue/MBS/reports", "venue_supervisor", agencyId)).toBe(true);
  });
});
