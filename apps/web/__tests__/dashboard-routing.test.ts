import { describe, expect, it } from "vitest";
import {
  dashboardRouteFromRole,
  normalizeRole,
} from "rapid-cortex-shared/auth/vertical-routing";

const cases = [
  // Platform
  ["rcsuperadmin", "__platform__", "/rc-admin"],
  ["rcadmin", "__platform__", "/rc-admin"],
  // 911
  ["dispatcher", "ga-columbus-appsondemand", "/ga-columbus/dispatcher"],
  ["supervisor", "test-agency", "/test-agency/supervisor"],
  ["agencyadmin", "tx-testville-testvillepsap", "/tx-testville/admin"],
  // Campus
  ["campus_security", "test-campus-uga", "/app/campus/security"],
  ["campus_admin", "test-campus-uga", "/app/campus/admin"],
  // Venue
  ["venue_security", "test-venue-mbs", "/app/venue/security"],
  ["venue_admin", "test-venue-mbs", "/app/venue/admin"],
  // Hospital
  ["hospital_staff", "test-hospital", "/app/hospital/staff"],
  // Transit
  ["transit_security", "test-transit", "/app/transit/security"],
  // Legacy
  ["admin", "test-agency", "/test-agency/admin"],
  ["platform_superadmin", "__platform__", "/rc-admin"],
  // Unknown
  ["unknown_role", "test-agency", "/not-authorized"],
] as const;

describe("dashboardRouteFromRole", () => {
  cases.forEach(([role, agencyId, expected]) => {
    it(`${role} → ${expected}`, () => {
      expect(dashboardRouteFromRole(role, agencyId)).toBe(expected);
    });
  });

  it("normalizeRole maps legacy admin", () => {
    expect(normalizeRole("admin")).toBe("agencyadmin");
  });
});
