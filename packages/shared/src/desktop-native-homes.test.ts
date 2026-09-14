import { describe, expect, it } from "vitest";
import { dashboardRouteFromRole } from "./auth/vertical-routing.js";

/**
 * Native Mac/Windows shells must land on these homes (WKWebView / WebView2).
 * Keep `DesktopRoleRouting.swift` and `DesktopPostLoginRouting.cs` in lockstep.
 */
const NATIVE_PRODUCT_HOMES: Array<[role: string, agencyId: string, path: string]> = [
  ["TRANSIT_ADMIN", "test-transit-hvt", "/app/transit/admin"],
  ["TRANSIT_SUPERVISOR", "test-transit-hvt", "/app/transit/supervisor"],
  ["TRANSIT_SECURITY", "test-transit-hvt", "/app/transit/security"],
  ["TRANSIT_OPERATOR", "test-transit-hvt", "/app/transit/operator"],
  ["CAMPUS_ADMIN", "test-campus-uga", "/app/campus/admin"],
  ["CAMPUS_SUPERVISOR", "test-campus-uga", "/app/campus/supervisor"],
  ["CAMPUS_SECURITY", "test-campus-uga", "/app/campus/security"],
  ["CAMPUS_DISPATCH", "test-campus-uga", "/app/campus/dispatch"],
  ["VENUE_SUPERVISOR", "test-venue-mbs", "/app/venue/supervisor"],
  ["VENUE_SECURITY", "test-venue-mbs", "/app/venue/security"],
  ["VENUE_OPERATOR", "test-venue-mbs", "/app/venue/operator"],
  ["HOSPITAL_ADMIN", "test-hospital", "/hospital-admin/dashboard"],
  ["HOSPITAL_STAFF", "test-hospital", "/hospital-staff/dashboard"],
  ["HOSPITAL_COORDINATOR", "test-hospital", "/hospital-admin/dashboard"],
];

describe("desktop native post-login homes", () => {
  it("never uses a bare /app/transit or /app/campus/{code} landing path", () => {
    for (const [role, agencyId, path] of NATIVE_PRODUCT_HOMES) {
      expect(path).not.toBe("/app/transit");
      expect(path).not.toMatch(/^\/app\/campus\/[A-Z0-9]+$/);
      const shared = dashboardRouteFromRole(role, agencyId);
      if (role === "CAMPUS_DISPATCH") {
        expect(path).toBe("/app/campus/dispatch");
        continue;
      }
      expect(shared).toBe(path);
    }
  });

  it("sends venue admin to the venue code workspace", () => {
    expect(dashboardRouteFromRole("VENUE_ADMIN", "test-venue-mbs")).toBe("/app/venue/MBS");
  });
});
