import { describe, expect, it } from "vitest";
import {
  dashboardRouteFromRole,
  jurisdictionFromAgencyId,
  normalizeRole,
  allowedRoutePrefixesForRole,
} from "./vertical-routing.js";

describe("jurisdictionFromAgencyId", () => {
  it("uses first two hyphen segments when present", () => {
    expect(jurisdictionFromAgencyId("ga-columbus-appsondemandpilotcenter")).toBe("ga-columbus");
    expect(jurisdictionFromAgencyId("tx-testville-testvillepsap")).toBe("tx-testville");
    expect(jurisdictionFromAgencyId("test-agency")).toBe("test-agency");
  });

  it("uses single segment when only one part", () => {
    expect(jurisdictionFromAgencyId("test")).toBe("test");
  });
});

describe("normalizeRole", () => {
  it("maps legacy tokens", () => {
    expect(normalizeRole("admin")).toBe("agencyadmin");
    expect(normalizeRole("platform_superadmin")).toBe("rcsuperadmin");
    expect(normalizeRole("staff")).toBe("staff");
  });
});

describe("dashboardRouteFromRole", () => {
  it("routes campus security to campus console", () => {
    expect(dashboardRouteFromRole("campus_security", "test-campus-uga")).toBe("/app/campus/security");
  });

  it("routes venue admin to venue admin console", () => {
    expect(dashboardRouteFromRole("venue_admin", "test-venue-mbs")).toBe("/app/venue/admin");
  });

  it("routes dispatcher to two-part jurisdiction path", () => {
    expect(dashboardRouteFromRole("dispatcher", "ga-columbus-appsondemandpilotcenter")).toBe(
      "/ga-columbus/dispatcher",
    );
    expect(dashboardRouteFromRole("supervisor", "test-agency")).toBe("/test-agency/supervisor");
  });

  it("routes rcsuperadmin to rc-admin", () => {
    expect(dashboardRouteFromRole("rcsuperadmin", "platform")).toBe("/rc-admin");
  });

  it("routes legacy admin to agency admin dashboard", () => {
    expect(dashboardRouteFromRole("admin", "test-agency")).toBe("/test-agency/admin");
  });

  it("routes disabled staff legacy role to not-authorized", () => {
    expect(dashboardRouteFromRole("staff", "test-agency")).toBe("/not-authorized");
  });

  it("routes unknown roles to not-authorized", () => {
    expect(dashboardRouteFromRole("unknown_role", "test-agency")).toBe("/not-authorized");
  });
});

describe("allowedRoutePrefixesForRole", () => {
  it("scopes campus roles to campus shell", () => {
    expect(allowedRoutePrefixesForRole("campus_security")).toEqual(["/app/campus"]);
  });

  it("allows 911 roles broad jurisdiction access", () => {
    expect(allowedRoutePrefixesForRole("dispatcher")).toEqual(["/"]);
  });
});

describe("pathMatchesRoleDashboard", () => {
  it("allows campus security on their console", async () => {
    const { pathMatchesRoleDashboard } = await import("./vertical-routing.js");
    expect(
      pathMatchesRoleDashboard("/app/campus/security", "campus_security", "test-campus-uga"),
    ).toBe(true);
  });

  it("blocks campus security from venue console", async () => {
    const { pathMatchesRoleDashboard } = await import("./vertical-routing.js");
    expect(pathMatchesRoleDashboard("/app/venue/admin", "campus_security", "test-campus-uga")).toBe(
      false,
    );
  });
});
