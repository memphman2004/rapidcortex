import { describe, expect, it } from "vitest";
import { canViewCampusNavItem, canViewVenueNavItem } from "./venue-nav-access";

describe("venue QR nav", () => {
  it("shows QR nav for venue admin and supervisor only", () => {
    expect(canViewVenueNavItem("qr", "VENUE_ADMIN")).toBe(true);
    expect(canViewVenueNavItem("qr", "VENUE_SUPERVISOR")).toBe(true);
    expect(canViewVenueNavItem("qr", "VENUE_SECURITY")).toBe(false);
    expect(canViewVenueNavItem("qr", "VENUE_OPERATOR")).toBe(false);
  });
});

describe("campus QR nav", () => {
  it("includes qr-codes for admin, supervisor, and security", () => {
    expect(canViewCampusNavItem("qr-codes", "CAMPUS_ADMIN")).toBe(true);
    expect(canViewCampusNavItem("qr-codes", "CAMPUS_SUPERVISOR")).toBe(true);
    expect(canViewCampusNavItem("qr-codes", "CAMPUS_SECURITY")).toBe(true);
    expect(canViewCampusNavItem("qr-codes", "CAMPUS_DISPATCH")).toBe(false);
  });
});
