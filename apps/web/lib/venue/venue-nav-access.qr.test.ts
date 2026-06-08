import { describe, expect, it } from "vitest";
import { canViewCampusNavItem, canViewVenueNavItem } from "./venue-nav-access";

describe("venue QR nav", () => {
  it("shows QR nav for venue admin and supervisor only", () => {
    expect(canViewVenueNavItem("qr", "VENUE_ADMIN")).toBe(true);
    expect(canViewVenueNavItem("qr", "VENUE_SUPERVISOR")).toBe(true);
    expect(canViewVenueNavItem("qr", "VENUE_OPERATOR")).toBe(false);
    expect(canViewVenueNavItem("qr", "VENUE_SECURITY")).toBe(false);
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

describe("campus admin-only nav", () => {
  it("shows users and settings only to CAMPUS_ADMIN and RC operators", () => {
    expect(canViewCampusNavItem("users", "CAMPUS_ADMIN")).toBe(true);
    expect(canViewCampusNavItem("settings", "CAMPUS_ADMIN")).toBe(true);
    expect(canViewCampusNavItem("users", "rcsuperadmin")).toBe(true);
    expect(canViewCampusNavItem("settings", "rcitadmin")).toBe(true);
    expect(canViewCampusNavItem("users", "CAMPUS_SUPERVISOR")).toBe(false);
    expect(canViewCampusNavItem("settings", "CAMPUS_DISPATCH")).toBe(false);
  });
});
