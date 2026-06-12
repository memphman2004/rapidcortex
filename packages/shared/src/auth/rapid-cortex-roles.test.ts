import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AGENCY_ASSIGNABLE_ROLES,
  HOSPITAL_ASSIGNABLE_ROLES,
  RAPID_CORTEX_ROLES,
  isHospitalAdminPortalRole,
  isHospitalStaffPortalRole,
  migrateLegacyRapidCortexRoleTokenValue,
  normalizeSessionRole,
  resolveHospitalPortalDashboardHref,
  ROLE_DISPLAY_LABELS,
  isHospitalPortalRole,
  isRapidCortexRole,
} from "./rapid-cortex-roles.js";
import { USER_ROLE_SCHEMA } from "../types.js";

describe("rapid-cortex-roles", () => {
  it("defines the canonical role list", () => {
    expect(RAPID_CORTEX_ROLES).toContain("rcsuperadmin");
    expect(RAPID_CORTEX_ROLES).toContain("campus_security");
    expect(RAPID_CORTEX_ROLES).toContain("venue_admin");
    expect(RAPID_CORTEX_ROLES).toContain("transit_operator");
    expect(RAPID_CORTEX_ROLES.length).toBeGreaterThanOrEqual(28);
  });

  it("labels hospital roles for customer-facing copy", () => {
    expect(ROLE_DISPLAY_LABELS.hospitaladmin).toBe("Hospital Admin");
    expect(ROLE_DISPLAY_LABELS.hospitalstaff).toBe("Hospital Staff");
  });

  it("allows every canonical role via USER_ROLE_SCHEMA", () => {
    for (const r of RAPID_CORTEX_ROLES) {
      expect(() => USER_ROLE_SCHEMA.parse(r)).not.toThrow();
    }
  });

  it("migration normalizes legacy token values only", () => {
    expect(migrateLegacyRapidCortexRoleTokenValue("platform_superadmin")).toBe("rcsuperadmin");
    expect(migrateLegacyRapidCortexRoleTokenValue("admin")).toBe("agencyadmin");
    expect(migrateLegacyRapidCortexRoleTokenValue("hospital_admin")).toBe("hospitaladmin");
    expect(migrateLegacyRapidCortexRoleTokenValue("hospital_staff")).toBe("hospitalstaff");
    expect(migrateLegacyRapidCortexRoleTokenValue("staff")).toBe("staff");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_ADMIN")).toBe("campus_admin");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_SUPERVISOR")).toBe("campus_supervisor");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_SECURITY")).toBe("campus_security");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_DISPATCH")).toBe("campus_security");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_COUNSELOR")).toBe("campus_counselor");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_FACULTY")).toBe("campus_faculty");
    expect(migrateLegacyRapidCortexRoleTokenValue(undefined)).toBeUndefined();
  });

  it("normalizeSessionRole maps product vertical tokens to canonical roles", () => {
    expect(normalizeSessionRole("VENUE_ADMIN")).toBe("venue_admin");
    expect(normalizeSessionRole("CAMPUS_ADMIN")).toBe("campus_admin");
    expect(normalizeSessionRole("HOSPITAL_STAFF")).toBe("hospital_staff");
    expect(normalizeSessionRole("CAMPUS_ADMIN")).not.toBe("agencyadmin");
  });

  it("isHospitalPortalRole accepts canonical and legacy hospital roles", () => {
    expect(isHospitalPortalRole("hospitaladmin")).toBe(true);
    expect(isHospitalPortalRole("hospitalstaff")).toBe(true);
    expect(isHospitalPortalRole("hospital_admin")).toBe(true);
    expect(isHospitalPortalRole("dispatcher")).toBe(false);
  });

  it("hospital portal helpers accept product tokens and canonical roles", () => {
    expect(isHospitalAdminPortalRole("hospitaladmin")).toBe(true);
    expect(isHospitalAdminPortalRole("HOSPITAL_ADMIN")).toBe(true);
    expect(isHospitalStaffPortalRole("hospitalstaff")).toBe(true);
    expect(isHospitalStaffPortalRole("HOSPITAL_STAFF")).toBe(true);
    expect(resolveHospitalPortalDashboardHref("HOSPITAL_ADMIN")).toBe("/hospital-admin/dashboard");
    expect(resolveHospitalPortalDashboardHref("HOSPITAL_STAFF")).toBe("/hospital-staff/dashboard");
    expect(resolveHospitalPortalDashboardHref("hospitaladmin")).toBe("/hospital-admin/dashboard");
  });

  it("isRapidCortexRole accepts canonical and migrated legacy literals", () => {
    expect(isRapidCortexRole("hospitaladmin")).toBe(true);
    expect(isRapidCortexRole("platform_superadmin")).toBe(true);
    expect(isRapidCortexRole("hospital_admin")).toBe(true);
    expect(isRapidCortexRole("CAMPUS_ADMIN")).toBe(true);
    expect(isRapidCortexRole("CAMPUS_SUPERVISOR")).toBe(true);
    expect(isRapidCortexRole("not_a_role")).toBe(false);
  });

  it("rejects legacy literals for new strict assignments (agency assignable enum)", () => {
    const agencyEnum = z.enum(
      AGENCY_ASSIGNABLE_ROLES as unknown as [
        (typeof AGENCY_ASSIGNABLE_ROLES)[number],
        ...(typeof AGENCY_ASSIGNABLE_ROLES)[number][],
      ],
    );
    expect(() => agencyEnum.parse("hospitaladmin")).toThrow();
    expect(() => agencyEnum.parse("dispatcher")).not.toThrow();
  });

  it("hospital assignable enum uses underscore-free role ids", () => {
    const hospitalEnum = z.enum(
      HOSPITAL_ASSIGNABLE_ROLES as unknown as [
        (typeof HOSPITAL_ASSIGNABLE_ROLES)[number],
        ...(typeof HOSPITAL_ASSIGNABLE_ROLES)[number][],
      ],
    );
    expect(() => hospitalEnum.parse("hospitaladmin")).not.toThrow();
    expect(() => hospitalEnum.parse("hospital_admin")).toThrow();
  });
});
