import { describe, expect, it } from "vitest";
import { canViewVenueNavItem, venueNavKeysForRole } from "./venue-nav-access";

describe("venue nav access", () => {
  it("guest services sees reports only — no dashboard, incident, or QR tools", () => {
    const keys = venueNavKeysForRole("VENUE_GUEST_SERVICES");
    expect(keys).toEqual(["reports"]);
    expect(keys).not.toContain("dashboard");
    expect(keys).not.toContain("incidents");
    expect(keys).not.toContain("qr");
    expect(canViewVenueNavItem("cameras", "VENUE_GUEST_SERVICES")).toBe(false);
  });

  it("operator sees dashboard and incidents only", () => {
    const keys = venueNavKeysForRole("VENUE_OPERATOR");
    expect(keys).toEqual(["dashboard", "incidents"]);
  });

  it("security role hides admin analytics and settings", () => {
    expect(canViewVenueNavItem("analytics", "VENUE_SECURITY")).toBe(false);
    expect(canViewVenueNavItem("settings", "VENUE_SECURITY")).toBe(false);
    expect(canViewVenueNavItem("cameras", "VENUE_SECURITY")).toBe(true);
  });

  it("supervisor role hides settings but keeps QR view", () => {
    expect(canViewVenueNavItem("settings", "VENUE_SUPERVISOR")).toBe(false);
    expect(canViewVenueNavItem("qr", "VENUE_SUPERVISOR")).toBe(true);
  });
});
