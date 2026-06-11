import { describe, expect, it } from "vitest";
import {
  dashboardRouteFromRole,
  pathMatchesRoleDashboard,
  verticalFromRole,
} from "./vertical-routing.js";

describe("verticalFromRole", () => {
  it("maps campus roles to campus vertical", () => {
    expect(verticalFromRole("campus_security")).toBe("campus");
    expect(verticalFromRole("CAMPUS_SECURITY")).toBe("campus");
  });

  it("maps 911 roles to 911 vertical", () => {
    expect(verticalFromRole("dispatcher")).toBe("911");
  });

  it("maps platform roles to platform vertical", () => {
    expect(verticalFromRole("rcsuperadmin")).toBe("platform");
  });
});

describe("dashboardRouteFromRole", () => {
  it("routes campus security to campus console", () => {
    expect(dashboardRouteFromRole("campus_security", "test-campus-uga")).toBe("/app/campus/security");
  });

  it("routes venue admin to venue admin console", () => {
    expect(dashboardRouteFromRole("venue_admin", "test-venue-mbs")).toBe("/app/venue/admin");
  });

  it("routes dispatcher to jurisdiction dispatcher path", () => {
    expect(dashboardRouteFromRole("dispatcher", "ga-columbus-appsondemandpilotcenter")).toBe(
      "/ga/dispatcher",
    );
  });

  it("routes rcsuperadmin to rc-admin", () => {
    expect(dashboardRouteFromRole("rcsuperadmin", "platform")).toBe("/rc-admin");
  });
});

describe("pathMatchesRoleDashboard", () => {
  it("allows campus security on their console", () => {
    expect(
      pathMatchesRoleDashboard("/app/campus/security", "campus_security", "test-campus-uga"),
    ).toBe(true);
  });

  it("blocks campus security from venue console", () => {
    expect(pathMatchesRoleDashboard("/app/venue/admin", "campus_security", "test-campus-uga")).toBe(
      false,
    );
  });
});
