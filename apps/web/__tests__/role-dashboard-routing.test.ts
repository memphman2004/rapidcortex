import { describe, expect, it } from "vitest";
import type { UserContext } from "rapid-cortex-shared";
import { normalizeSessionRole } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { jurisdictionRoleHomeHref } from "../lib/auth/role-home";
import { userMayAccessDashboardPrefix } from "../lib/dashboards/dashboard-access";
import {
  extractCampusCode,
  extractVenueCode,
  resolvePostAuthenticationHomeHref,
  resolveProductDashboardFromRoleAndAgency,
} from "../lib/auth/post-login-redirect";
import { normalizeRole } from "../lib/auth/roles";

const slug = "columbus";

function user(role: string, agencyId: string): UserContext {
  return {
    userId: "u1",
    agencyId,
    role: normalizeRole(role) as UserContext["role"],
    email: "test@example.com",
    passwordLastChangedAt: new Date().toISOString(),
    isSubscriber: true,
    planId: "enterprise_statewide",
  };
}

describe("role → dashboard routing", () => {
  describe("PSAP roles (jurisdiction workspace)", () => {
    it.each([
      ["dispatcher", "/ga-columbus/dispatcher", "ga-columbus-demo"],
      ["supervisor", "/ga-columbus/supervisor", "ga-columbus-demo"],
      ["agencyadmin", "/ga-columbus/admin", "ga-columbus-demo"],
      ["agencyit", "/ga-columbus/it", "ga-columbus-demo"],
      ["analyst", "/ga-columbus/analytics", "ga-columbus-demo"],
      ["auditor", "/ga-columbus/audit", "ga-columbus-demo"],
    ] as const)("maps %s to %s", (role, expected, agencyId) => {
      expect(jurisdictionRoleHomeHref(role, slug, agencyId)).toBe(expected);
      expect(resolvePostAuthenticationHomeHref(user(role, agencyId), slug)).toBe(expected);
    });
  });

  describe("RC internal roles", () => {
    it.each([
      ["rcsuperadmin", "/rc-admin/dashboard"],
      ["rcadmin", "/rc-admin/dashboard"],
      ["rcitadmin", "/rc-admin/infrastructure"],
    ] as const)("maps %s to %s", (role, expected) => {
      expect(resolveProductDashboardFromRoleAndAgency(role, "__platform__")).toBe("");
      expect(resolvePostAuthenticationHomeHref(user(role, "__platform__"), slug)).toBe(expected);
    });
  });

  describe("Hospital roles (facility portal)", () => {
    it.each([
      ["hospital_admin", "/app/hospital/admin"],
      ["hospital_staff", "/app/hospital/staff"],
      ["HOSPITAL_ADMIN", "/app/hospital/admin"],
      ["HOSPITAL_STAFF", "/app/hospital/staff"],
    ] as const)("maps %s to %s", (role, expected) => {
      expect(jurisdictionRoleHomeHref(role, slug, "test-hospital")).toBe(expected);
      expect(resolveProductDashboardFromRoleAndAgency(role, "test-hospital")).toBe(expected);
      expect(resolvePostAuthenticationHomeHref(user(role, "test-hospital"), slug)).toBe(expected);
    });
  });

  describe("Venue product roles", () => {
    it("normalizes VENUE_* tokens to canonical venue roles", () => {
      expect(normalizeSessionRole("VENUE_SUPERVISOR")).toBe("venue_supervisor");
      expect(normalizeRole("VENUE_ADMIN")).toBe("venue_admin");
    });

    it("routes venue roles to role dashboards", () => {
      expect(
        resolveProductDashboardFromRoleAndAgency("VENUE_SUPERVISOR", "test-venue-mbs"),
      ).toBe("/app/venue/supervisor");
      expect(
        resolvePostAuthenticationHomeHref(user("VENUE_OPERATOR", "venue-truist"), slug),
      ).toBe("/app/venue/operator");
    });
  });

  describe("Campus product roles", () => {
    it("normalizes CAMPUS_* tokens to canonical campus roles", () => {
      expect(normalizeSessionRole("CAMPUS_ADMIN")).toBe("campus_admin");
      expect(normalizeRole("CAMPUS_SECURITY")).toBe("campus_security");
    });

    it("routes campus roles to role dashboards", () => {
      expect(
        resolveProductDashboardFromRoleAndAgency("CAMPUS_SUPERVISOR", "test-campus-lincoln"),
      ).toBe("/app/campus/supervisor");
      expect(
        resolvePostAuthenticationHomeHref(user("CAMPUS_DISPATCH", "campus-westview"), slug),
      ).toBe("/app/campus/security");
    });
  });

  describe("agency id code extraction", () => {
    it("extracts venue and campus codes from tenant agency ids", () => {
      expect(extractVenueCode("test-venue-mbs")).toBe("MBS");
      expect(extractCampusCode("test-campus-lincoln-high")).toBe("LINCOLNHIGH");
    });
  });

  describe("hospital dashboard RBAC", () => {
    it("grants hospital-admin prefix to HOSPITAL_* admin tokens", () => {
      const admin = user("HOSPITAL_ADMIN", "agency-hospital-001");
      expect(userMayAccessDashboardPrefix(admin, "hospital-admin")).toBe(true);
      expect(userMayAccessDashboardPrefix(admin, "hospital-staff")).toBe(false);
    });

    it("grants hospital-staff prefix to HOSPITAL_* staff tokens", () => {
      const staff = user("HOSPITAL_STAFF", "agency-hospital-001");
      expect(userMayAccessDashboardPrefix(staff, "hospital-staff")).toBe(true);
      expect(userMayAccessDashboardPrefix(staff, "hospital-admin")).toBe(false);
    });
  });
});
