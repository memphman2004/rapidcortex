import { describe, expect, it } from "vitest";
import type { UserContext, UserRole } from "rapid-cortex-shared";
import { AuthorizationService } from "./authorization-service.js";
import type { Permission } from "./permissions.js";

function makeUser(role: UserRole, overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: `user-${role}`,
    agencyId: "agency-a",
    role,
    email: `${role}@example.com`,
    ...overrides,
  };
}

describe("AuthorizationService.canPerform / assertCanPerform", () => {
  const auth = new AuthorizationService();

  describe("rcsuperadmin escape hatch", () => {
    it("grants every permission to rcsuperadmin without consulting the matrix", () => {
      const su = makeUser("rcsuperadmin");
      const everyPermission: Permission[] = [
        "qa.scorecards_create",
        "billing.revenue_view",
        "system.retention",
        "transcripts.delete",
        "users.deactivate_emergency",
        "workspace.silent_monitor",
      ];
      for (const p of everyPermission) {
        expect(auth.canPerform(su, p)).toBe(true);
        expect(() => auth.assertCanPerform(su, p)).not.toThrow();
      }
    });
  });

  describe("rcitadmin cross-tenant elevation", () => {
    it("grants the RCITADMIN_CROSS_TENANT_PERMISSIONS slice", () => {
      const itAdmin = makeUser("rcitadmin");
      const crossTenant: Permission[] = [
        "users.reset_password",
        "users.unlock",
        "users.reset_mfa",
        "users.deactivate_emergency",
        "system.mfa_policy",
      ];
      for (const p of crossTenant) {
        expect(auth.canPerform(itAdmin, p)).toBe(true);
      }
    });

    it("does NOT grant permissions outside the cross-tenant allowlist (e.g. billing.revenue_view)", () => {
      const itAdmin = makeUser("rcitadmin");
      expect(auth.canPerform(itAdmin, "billing.revenue_view")).toBe(false);
      expect(() => auth.assertCanPerform(itAdmin, "billing.revenue_view")).toThrow("FORBIDDEN_PERMISSION");
    });
  });

  describe("agency role mapping (Role Access Matrix v2.0)", () => {
    it("denies dispatcher rms.finalize_report and grants supervisor", () => {
      const dispatcher = makeUser("dispatcher");
      const supervisor = makeUser("supervisor");
      expect(auth.canPerform(dispatcher, "rms.finalize_report")).toBe(false);
      expect(() => auth.assertCanPerform(dispatcher, "rms.finalize_report")).toThrow(
        "FORBIDDEN_PERMISSION",
      );
      expect(auth.canPerform(supervisor, "rms.finalize_report")).toBe(true);
      expect(auth.canPerform(dispatcher, "rms.generate_report")).toBe(true);
      expect(auth.canPerform(dispatcher, "rms.push_to_rms")).toBe(false);
    });

    it("denies dispatcher access to qa.scorecards_create", () => {
      const dispatcher = makeUser("dispatcher");
      expect(auth.canPerform(dispatcher, "qa.scorecards_create")).toBe(false);
      expect(() => auth.assertCanPerform(dispatcher, "qa.scorecards_create")).toThrow("FORBIDDEN_PERMISSION");
    });

    it("grants supervisor qa.scorecards_create + qa.coaching_create", () => {
      const sup = makeUser("supervisor");
      expect(auth.canPerform(sup, "qa.scorecards_create")).toBe(true);
      expect(auth.canPerform(sup, "qa.coaching_create")).toBe(true);
    });

    it("denies dispatcher billing.revenue_view", () => {
      const dispatcher = makeUser("dispatcher");
      expect(auth.canPerform(dispatcher, "billing.revenue_view")).toBe(false);
    });

    it("denies agencyadmin billing.revenue_view (rcsuperadmin-only per matrix)", () => {
      const agencyAdmin = makeUser("agencyadmin");
      expect(auth.canPerform(agencyAdmin, "billing.revenue_view")).toBe(false);
    });
  });

  describe("error shape", () => {
    it("throws a 403-coded Error with permission field on denial", () => {
      const dispatcher = makeUser("dispatcher");
      let captured: unknown = null;
      try {
        auth.assertCanPerform(dispatcher, "qa.scorecards_create");
      } catch (e) {
        captured = e;
      }
      expect(captured).toBeInstanceOf(Error);
      const err = captured as Error & { statusCode?: number; permission?: string };
      expect(err.message).toBe("FORBIDDEN_PERMISSION");
      expect(err.statusCode).toBe(403);
      expect(err.permission).toBe("qa.scorecards_create");
    });

    it("returns silently on grant (no return value, no throw)", () => {
      const sup = makeUser("supervisor");
      const result = auth.assertCanPerform(sup, "qa.scorecards_view");
      expect(result).toBeUndefined();
    });
  });

  describe("legacy role token migration", () => {
    it("normalizes legacy 'admin' token to agencyadmin before consulting matrix (same result as canonical agencyadmin)", () => {
      const legacy = makeUser("admin" as UserRole);
      const canonical = makeUser("agencyadmin");
      const sample: Permission[] = [
        "qa.scorecards_view",
        "incidents.view",
        "users.view",
        "billing.revenue_view",
      ];
      for (const p of sample) {
        expect(auth.canPerform(legacy, p)).toBe(auth.canPerform(canonical, p));
      }
    });

    it("maps CAMPUS_* role aliases to the same permission baseline as their canonical roles", () => {
      const campusAdmin = makeUser("CAMPUS_ADMIN" as UserRole);
      const campusSupervisor = makeUser("CAMPUS_SUPERVISOR" as UserRole);
      const agencyAdmin = makeUser("agencyadmin");
      const supervisor = makeUser("supervisor");

      expect(auth.canPerform(campusAdmin, "users.create")).toBe(
        auth.canPerform(agencyAdmin, "users.create"),
      );
      expect(auth.canPerform(campusAdmin, "incidents.view_all")).toBe(
        auth.canPerform(agencyAdmin, "incidents.view_all"),
      );
      expect(auth.canPerform(campusSupervisor, "qa.scorecards_create")).toBe(
        auth.canPerform(supervisor, "qa.scorecards_create"),
      );
    });

    it("grants campus.* permissions for session-normalized campus_admin tokens", () => {
      const sessionCampusAdmin = makeUser("campus_admin" as UserRole, {
        agencyId: "last-campus-uga",
      });
      expect(auth.canPerform(sessionCampusAdmin, "campus.clery.view")).toBe(true);
      expect(auth.canPerform(sessionCampusAdmin, "campus.clery.manage")).toBe(true);
      expect(auth.canPerform(sessionCampusAdmin, "campus.analytics.view")).toBe(true);
      expect(auth.canCreateInvite(sessionCampusAdmin, "last-campus-uga")).toBe(true);
      expect(auth.canCreateInvite(sessionCampusAdmin, "other-agency")).toBe(false);
    });

    it("grants venue invite creation for session-normalized venue_admin tokens", () => {
      const sessionVenueAdmin = makeUser("venue_admin" as UserRole, {
        agencyId: "last-venue-acme",
      });
      expect(auth.canCreateInvite(sessionVenueAdmin, "last-venue-acme")).toBe(true);
      expect(auth.canCreateInvite(sessionVenueAdmin, "other-agency")).toBe(false);
    });
  });

  describe("transit roles", () => {
    it("grants transit_security incident create and denies alert.manage", () => {
      const security = makeUser("transit_security");
      expect(auth.canPerform(security, "transit.incidents.create")).toBe(true);
      expect(auth.canPerform(security, "transit.alert.manage")).toBe(false);
      expect(auth.canPerform(security, "transit.incidents.escalate")).toBe(false);
      expect(auth.canPerform(security, "transit.cameras.view")).toBe(true);
      expect(auth.canPerform(security, "transit.cameras.manage")).toBe(false);
      expect(() => auth.assertCanPerform(security, "transit.alert.manage")).toThrow(
        "FORBIDDEN_PERMISSION",
      );
    });

    it("grants transit_supervisor alert.manage and denies fleet.manage", () => {
      const supervisor = makeUser("transit_supervisor");
      expect(auth.canPerform(supervisor, "transit.alert.manage")).toBe(true);
      expect(auth.canPerform(supervisor, "transit.cameras.manage")).toBe(true);
      expect(auth.canPerform(supervisor, "transit.fleet.manage")).toBe(false);
    });

    it("denies PSAP dispatcher transit.dashboard.view", () => {
      const dispatcher = makeUser("dispatcher");
      expect(auth.canPerform(dispatcher, "transit.dashboard.view")).toBe(false);
    });

    it("maps TRANSIT_ADMIN alias to transit.admin grants", () => {
      const admin = makeUser("TRANSIT_ADMIN" as UserRole);
      expect(auth.canPerform(admin, "transit.settings.manage")).toBe(true);
      expect(auth.canPerform(admin, "transit.broadcast.send")).toBe(true);
      expect(auth.canPerform(admin, "locations.qrcodes.manage")).toBe(true);
    });

    it("lets transit_admin create invites for the same agency", () => {
      const admin = makeUser("transit_admin");
      expect(auth.canCreateInvite(admin, "agency-a")).toBe(true);
      expect(auth.canCreateInvite(admin, "other-agency")).toBe(false);
    });
  });

describe("CAD Connector permissions", () => {
    it("grants dispatcher feed + submit and denies connector manage", () => {
      const dispatcher = makeUser("dispatcher");
      expect(auth.canPerform(dispatcher, "cad.incidents.view")).toBe(true);
      expect(auth.canPerform(dispatcher, "cad.writeback.submit")).toBe(true);
      expect(auth.canPerform(dispatcher, "cad.connector.manage")).toBe(false);
      expect(auth.canPerform(dispatcher, "cad.writeback.approve")).toBe(false);
    });

    it("grants supervisor approve/reject and denies connector delete", () => {
      const supervisor = makeUser("supervisor");
      expect(auth.canPerform(supervisor, "cad.writeback.approve")).toBe(true);
      expect(auth.canPerform(supervisor, "cad.audit.view")).toBe(true);
      expect(auth.canPerform(supervisor, "cad.connector.delete")).toBe(false);
    });

    it("grants agencyit connector delete", () => {
      const it = makeUser("agencyit");
      expect(auth.canPerform(it, "cad.connector.delete")).toBe(true);
      expect(auth.canPerform(it, "cad.routing.manage")).toBe(true);
    });
  });
});

describe("AuthorizationService.assertAgencyAdminManagingSameAgency", () => {
  const auth = new AuthorizationService();

  it("allows CAMPUS_ADMIN for the same agency (mutual-aid demo)", () => {
    const admin = makeUser("CAMPUS_ADMIN" as UserRole);
    expect(() => auth.assertAgencyAdminManagingSameAgency(admin, "agency-a")).not.toThrow();
    expect(() => auth.assertAgencyAdminManagingSameAgency(admin, "other-agency")).toThrow("FORBIDDEN");
  });

  it("allows TRANSIT_ADMIN for the same agency", () => {
    const admin = makeUser("transit_admin");
    expect(() => auth.assertAgencyAdminManagingSameAgency(admin, "agency-a")).not.toThrow();
    expect(() => auth.assertAgencyAdminManagingSameAgency(admin, "other-agency")).toThrow("FORBIDDEN");
  });
});
