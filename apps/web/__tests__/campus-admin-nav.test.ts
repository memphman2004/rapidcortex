import { describe, expect, it } from "vitest";
import type { UserContext } from "rapid-cortex-shared/types";
import { canAccessCampusAdminRoutes, CAMPUS_ASSIGNABLE_ROLES } from "@/lib/campus/campus-access";

function makeUser(role: string, agencyId = "campus-csu"): UserContext {
  return {
    userId: "user-1",
    email: `${role}@test.edu`,
    role: role as UserContext["role"],
    agencyId,
  };
}

const CAMPUS_AGENCY_ID = "campus-csu";
const OTHER_CAMPUS_ID = "campus-other";

describe("canAccessCampusAdminRoutes", () => {
  it("grants CAMPUS_ADMIN access to own campus agencyId", () => {
    expect(
      canAccessCampusAdminRoutes(makeUser("CAMPUS_ADMIN", CAMPUS_AGENCY_ID), CAMPUS_AGENCY_ID),
    ).toBe(true);
  });

  it("blocks CAMPUS_ADMIN from a different campus agencyId", () => {
    expect(
      canAccessCampusAdminRoutes(makeUser("CAMPUS_ADMIN", CAMPUS_AGENCY_ID), OTHER_CAMPUS_ID),
    ).toBe(false);
  });

  it("grants rcsuperadmin access to any campus agencyId", () => {
    expect(
      canAccessCampusAdminRoutes(makeUser("rcsuperadmin", "__platform__"), CAMPUS_AGENCY_ID),
    ).toBe(true);
    expect(
      canAccessCampusAdminRoutes(makeUser("rcsuperadmin", "__platform__"), OTHER_CAMPUS_ID),
    ).toBe(true);
  });

  it("grants rcadmin access to any campus agencyId", () => {
    expect(canAccessCampusAdminRoutes(makeUser("rcadmin", "__platform__"), CAMPUS_AGENCY_ID)).toBe(
      true,
    );
  });

  it("grants rcitadmin access to any campus agencyId", () => {
    expect(
      canAccessCampusAdminRoutes(makeUser("rcitadmin", "__platform__"), CAMPUS_AGENCY_ID),
    ).toBe(true);
  });

  it("blocks CAMPUS_SUPERVISOR", () => {
    expect(
      canAccessCampusAdminRoutes(makeUser("CAMPUS_SUPERVISOR", CAMPUS_AGENCY_ID), CAMPUS_AGENCY_ID),
    ).toBe(false);
  });

  it("blocks CAMPUS_SECURITY", () => {
    expect(
      canAccessCampusAdminRoutes(makeUser("CAMPUS_SECURITY", CAMPUS_AGENCY_ID), CAMPUS_AGENCY_ID),
    ).toBe(false);
  });

  it("blocks CAMPUS_DISPATCH", () => {
    expect(
      canAccessCampusAdminRoutes(makeUser("CAMPUS_DISPATCH", CAMPUS_AGENCY_ID), CAMPUS_AGENCY_ID),
    ).toBe(false);
  });

  it("blocks PSAP dispatcher", () => {
    expect(canAccessCampusAdminRoutes(makeUser("dispatcher", "psap-agency"), CAMPUS_AGENCY_ID)).toBe(
      false,
    );
  });

  it("blocks PSAP agencyadmin", () => {
    expect(
      canAccessCampusAdminRoutes(makeUser("agencyadmin", "psap-agency"), CAMPUS_AGENCY_ID),
    ).toBe(false);
  });

  it("blocks VENUE_ADMIN", () => {
    expect(canAccessCampusAdminRoutes(makeUser("VENUE_ADMIN", "venue-mbs"), CAMPUS_AGENCY_ID)).toBe(
      false,
    );
  });
});

describe("CAMPUS_ASSIGNABLE_ROLES", () => {
  const roleValues = CAMPUS_ASSIGNABLE_ROLES.map((r) => r.value);

  it("includes all four campus roles", () => {
    expect(roleValues).toContain("CAMPUS_ADMIN");
    expect(roleValues).toContain("CAMPUS_SUPERVISOR");
    expect(roleValues).toContain("CAMPUS_SECURITY");
    expect(roleValues).toContain("CAMPUS_DISPATCH");
  });

  it("does not include any PSAP roles", () => {
    const psapRoles = ["dispatcher", "supervisor", "agencyadmin", "agencyit", "analyst", "auditor"];
    for (const r of psapRoles) {
      expect(roleValues).not.toContain(r);
    }
  });

  it("does not include any RC internal roles", () => {
    const rcRoles = ["rcsuperadmin", "rcadmin", "rcitadmin"];
    for (const r of rcRoles) {
      expect(roleValues).not.toContain(r);
    }
  });

  it("does not include any venue roles", () => {
    const venueRoles = [
      "VENUE_ADMIN",
      "VENUE_SUPERVISOR",
      "VENUE_SECURITY",
      "VENUE_OPERATOR",
      "VENUE_GUEST_SERVICES",
    ];
    for (const r of venueRoles) {
      expect(roleValues).not.toContain(r);
    }
  });

  it("does not include transit or hospital roles", () => {
    const otherRoles = ["TRANSIT_ADMIN", "HOSPITAL_ADMIN", "HOSPITAL_STAFF"];
    for (const r of otherRoles) {
      expect(roleValues).not.toContain(r);
    }
  });

  it("every role has a label and description", () => {
    for (const role of CAMPUS_ASSIGNABLE_ROLES) {
      expect(role.label.length).toBeGreaterThan(0);
      expect(role.description.length).toBeGreaterThan(0);
    }
  });
});
