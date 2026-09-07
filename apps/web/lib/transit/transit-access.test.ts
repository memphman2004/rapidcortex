import { describe, expect, it } from "vitest";
import {
  TRANSIT_ASSIGNABLE_ROLES,
  canAccessTransitAdminRoutes,
  isTransitAssignableRole,
} from "./transit-access";

function makeUser(role: string, agencyId = "test-transit-hvt") {
  return { role, agencyId };
}

describe("canAccessTransitAdminRoutes", () => {
  const agencyId = "test-transit-hvt";

  it("grants TRANSIT_ADMIN and transit_admin on the same agency", () => {
    expect(canAccessTransitAdminRoutes(makeUser("TRANSIT_ADMIN"), agencyId)).toBe(true);
    expect(canAccessTransitAdminRoutes(makeUser("transit_admin"), agencyId)).toBe(true);
  });

  it("blocks transit admin on a different agency", () => {
    expect(canAccessTransitAdminRoutes(makeUser("TRANSIT_ADMIN"), "other-transit")).toBe(false);
  });

  it("blocks supervisor, security, and operator from user admin APIs", () => {
    expect(canAccessTransitAdminRoutes(makeUser("TRANSIT_SUPERVISOR"), agencyId)).toBe(false);
    expect(canAccessTransitAdminRoutes(makeUser("TRANSIT_SECURITY"), agencyId)).toBe(false);
    expect(canAccessTransitAdminRoutes(makeUser("TRANSIT_OPERATOR"), agencyId)).toBe(false);
  });

  it("grants RC internal operators cross-tenant", () => {
    expect(canAccessTransitAdminRoutes(makeUser("rcsuperadmin", "__platform__"), agencyId)).toBe(
      true,
    );
  });
});

describe("TRANSIT_ASSIGNABLE_ROLES", () => {
  it("includes admin, supervisor, security, and operator only", () => {
    expect(TRANSIT_ASSIGNABLE_ROLES.map((r) => r.value)).toEqual([
      "TRANSIT_ADMIN",
      "TRANSIT_SUPERVISOR",
      "TRANSIT_SECURITY",
      "TRANSIT_OPERATOR",
    ]);
    expect(isTransitAssignableRole("transit_supervisor")).toBe(true);
    expect(isTransitAssignableRole("dispatcher")).toBe(false);
  });
});
