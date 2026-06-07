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
      ["dispatcher", `/${slug}/dashboard`],
      ["supervisor", `/${slug}/supervisor`],
      ["agencyadmin", `/${slug}/admin`],
      ["agencyit", `/${slug}/admin/it`],
      ["analyst", `/${slug}/analytics`],
      ["auditor", `/${slug}/audit`],
    ] as const)("maps %s to %s", (role, expected) => {
      expect(jurisdictionRoleHomeHref(role, slug)).toBe(expected);
      expect(resolvePostAuthenticationHomeHref(user(role, "agency-demo-001"), slug)).toBe(expected);
    });
  });

  describe("RC internal roles", () => {
    it.each([
      ["rcsuperadmin", "/rc-admin/dashboard"],
      ["rcadmin", "/rc-admin/dashboard"],
      ["rcitadmin", "/rc-admin/infrastructure"],
    ] as const)("maps %s to %s", (role, expected) => {
      expect(resolveProductDashboardFromRoleAndAgency(role, "__platform__")).toBe(expected);
      expect(resolvePostAuthenticationHomeHref(user(role, "__platform__"), slug)).toBe(expected);
    });
  });

  describe("Hospital roles (facility portal)", () => {
    it.each([
      ["hospitaladmin", "/hospital-admin/dashboard"],
      ["hospitalstaff", "/hospital-staff/dashboard"],
      ["HOSPITAL_ADMIN", "/hospital-admin/dashboard"],
      ["HOSPITAL_STAFF", "/hospital-staff/dashboard"],
    ] as const)("maps %s to %s", (role, expected) => {
      if (role === "hospitaladmin" || role === "hospitalstaff") {
        expect(jurisdictionRoleHomeHref(role, slug)).toBe(expected);
      }
      expect(resolveProductDashboardFromRoleAndAgency(role, "agency-hospital-001")).toBe(expected);
      expect(resolvePostAuthenticationHomeHref(user(role, "agency-hospital-001"), slug)).toBe(expected);
    });
  });

  describe("Venue product roles", () => {
    it("preserves VENUE_* tokens in session (not dispatcher fallback)", () => {
      expect(normalizeSessionRole("VENUE_SUPERVISOR")).toBe("VENUE_SUPERVISOR");
      expect(normalizeRole("VENUE_ADMIN")).toBe("VENUE_ADMIN");
    });

    it("routes venue roles to /app/venue/{code}", () => {
      expect(
        resolveProductDashboardFromRoleAndAgency("VENUE_SUPERVISOR", "test-venue-mbs"),
      ).toBe("/app/venue/MBS");
      expect(
        resolvePostAuthenticationHomeHref(user("VENUE_OPERATOR", "venue-truist"), slug),
      ).toBe("/app/venue/TRUIST");
    });
  });

  describe("Campus product roles", () => {
    it("preserves CAMPUS_* tokens in session (not PSAP migration)", () => {
      expect(normalizeSessionRole("CAMPUS_ADMIN")).toBe("CAMPUS_ADMIN");
      expect(normalizeRole("CAMPUS_SECURITY")).toBe("CAMPUS_SECURITY");
    });

    it("routes campus roles to /app/campus/{code}", () => {
      expect(
        resolveProductDashboardFromRoleAndAgency("CAMPUS_SUPERVISOR", "test-campus-lincoln"),
      ).toBe("/app/campus/LINCOLN");
      expect(
        resolvePostAuthenticationHomeHref(user("CAMPUS_DISPATCH", "campus-westview"), slug),
      ).toBe("/app/campus/WESTVIEW");
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
