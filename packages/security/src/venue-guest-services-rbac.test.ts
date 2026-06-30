import { describe, expect, it } from "vitest";
import type { UserContext } from "rapid-cortex-shared";
import { AuthorizationService } from "./authorization-service.js";
import { ROLE_ACCESS_MATRIX_V2 } from "./role-access-matrix-v2.js";
import { defaultPermissionForRole } from "./permissions.js";

describe("venue guest services RBAC regression", () => {
  const auth = new AuthorizationService();

  const guestUser = (role: string): UserContext => ({
    role: role as UserContext["role"],
    agencyId: "test-venue-mbs",
    userId: "guest-1",
    email: "venue-guest@appsondemand.net",
  });

  it("venue_guest matrix does not inherit auditor PSAP incident read grants", () => {
    expect(ROLE_ACCESS_MATRIX_V2.venue_guest).toEqual(["venue.dashboard.view"]);
    expect(ROLE_ACCESS_MATRIX_V2.venue_guest).not.toContain("incidents.view");
    expect(ROLE_ACCESS_MATRIX_V2.venue_guest).not.toContain("incidents.view_all");
    expect(ROLE_ACCESS_MATRIX_V2.auditor).toContain("incidents.view");
  });

  it.each(["venue_guest", "VENUE_GUEST_SERVICES"] as const)(
    "%s does not receive incidents.view via AuthorizationService",
    (role) => {
      const user = guestUser(role);
      expect(auth.canPerform(user, "incidents.view")).toBe(false);
      expect(auth.canPerform(user, "incidents.view_all")).toBe(false);
      expect(auth.canPerform(user, "transcripts.view")).toBe(false);
      expect(auth.canPerform(user, "audit.export")).toBe(false);
      expect(auth.canPerform(user, "venue.dashboard.view")).toBe(true);
      expect(defaultPermissionForRole("venue_guest", "incidents.view")).toBe(false);
    },
  );
});
