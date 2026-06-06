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
  });

  describe("hospital roles", () => {
    it("grants hospitalstaff hospital_portal.view but not capacity_manage", () => {
      const staff = makeUser("hospitalstaff");
      expect(auth.canPerform(staff, "hospital_portal.view")).toBe(true);
      expect(auth.canPerform(staff, "hospital_portal.users_manage")).toBe(false);
    });
  });
});
