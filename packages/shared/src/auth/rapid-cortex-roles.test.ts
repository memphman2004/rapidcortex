import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AGENCY_ASSIGNABLE_ROLES,
  CAMPUS_ASSIGNABLE_ROLES,
  HOSPITAL_ASSIGNABLE_ROLES,
  RAPID_CORTEX_ROLES,
  campusAssignableRolesForProduct,
  campusMatrixRoleFromRole,
  campusProductFromRole,
  campusRoleFamily,
  isCampusAdminRole,
  isCampusRoleToken,
  isHospitalAdminPortalRole,
  isHospitalStaffPortalRole,
  migrateLegacyRapidCortexRoleTokenValue,
  normalizeSessionRole,
  resolveHospitalPortalDashboardHref,
  ROLE_DISPLAY_LABELS,
  isHospitalPortalRole,
  isRapidCortexRole,
  roleDisplayLabel,
} from "./rapid-cortex-roles.js";
import { USER_ROLE_SCHEMA } from "../types.js";

describe("rapid-cortex-roles", () => {
  it("defines the canonical role list", () => {
    expect(RAPID_CORTEX_ROLES).toContain("rcsuperadmin");
    expect(RAPID_CORTEX_ROLES).toContain("campus_security_k12");
    expect(RAPID_CORTEX_ROLES).toContain("campus_admin_highered");
    expect(RAPID_CORTEX_ROLES).toContain("campus_dispatch_k12");
    expect(RAPID_CORTEX_ROLES).toContain("venue_admin");
    expect(RAPID_CORTEX_ROLES).toContain("transit_operator");
    expect(RAPID_CORTEX_ROLES).toContain("call_assist_operator");
    expect(RAPID_CORTEX_ROLES.length).toBeGreaterThanOrEqual(38);
  });

  it("labels hospital roles for customer-facing copy", () => {
    expect(ROLE_DISPLAY_LABELS.hospitaladmin).toBe("Hospital Admin");
    expect(ROLE_DISPLAY_LABELS.hospitalstaff).toBe("Hospital Staff");
  });

  it("labels Call Assist Cognito-group tokens for user-management dropdowns", () => {
    expect(roleDisplayLabel("CALL_ASSIST_ADMIN")).toBe("Call Assist Admin");
    expect(roleDisplayLabel("CALL_ASSIST_SUPERVISOR")).toBe("Call Assist Supervisor");
    expect(roleDisplayLabel("CALL_ASSIST_OPERATOR")).toBe("Call Assist Operator");
    expect(roleDisplayLabel("call_assist_operator")).toBe("Call Assist Operator");
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
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_ADMIN")).toBe("campus_admin_k12");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_SUPERVISOR")).toBe("campus_supervisor_k12");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_SECURITY")).toBe("campus_security_k12");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_DISPATCH")).toBe("campus_dispatch_k12");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_ADMIN_HIGHERED")).toBe("campus_admin_highered");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_DISPATCH_K12")).toBe("campus_dispatch_k12");
    expect(migrateLegacyRapidCortexRoleTokenValue("campus_admin")).toBe("campus_admin_k12");
    expect(migrateLegacyRapidCortexRoleTokenValue("TRANSIT_ADMIN")).toBe("transit_admin");
    expect(migrateLegacyRapidCortexRoleTokenValue("transit-supervisor")).toBe("transit_supervisor");
    expect(migrateLegacyRapidCortexRoleTokenValue("TRANSIT_OPERATOR")).toBe("transit_operator");
    expect(migrateLegacyRapidCortexRoleTokenValue("CALL_ASSIST_ADMIN")).toBe("call_assist_admin");
    expect(migrateLegacyRapidCortexRoleTokenValue("CALL_ASSIST_OPERATOR")).toBe("call_assist_operator");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_COUNSELOR")).toBe("campus_counselor_k12");
    expect(migrateLegacyRapidCortexRoleTokenValue("HOSPITAL_ADMIN")).toBe("hospital_admin");
    expect(migrateLegacyRapidCortexRoleTokenValue("HOSPITAL_COORDINATOR")).toBe("hospital_coord");
    expect(migrateLegacyRapidCortexRoleTokenValue("commsupervisor")).toBe("supervisor");
    expect(migrateLegacyRapidCortexRoleTokenValue("COMMSUPERVISOR")).toBe("supervisor");
    expect(migrateLegacyRapidCortexRoleTokenValue(undefined)).toBeUndefined();
  });

  it("normalizeSessionRole maps product vertical tokens to canonical roles", () => {
    expect(normalizeSessionRole("VENUE_ADMIN")).toBe("venue_admin");
    expect(normalizeSessionRole("venue-admin")).toBe("venue_admin");
    expect(normalizeSessionRole("campusadmin")).toBe("campus_admin_k12");
    expect(normalizeSessionRole("CAMPUS_ADMIN")).toBe("campus_admin_k12");
    expect(normalizeSessionRole("CAMPUS_ADMIN_HIGHERED")).toBe("campus_admin_highered");
    expect(normalizeSessionRole("HOSPITAL_STAFF")).toBe("hospital_staff");
    expect(normalizeSessionRole("CAMPUS_ADMIN")).not.toBe("agencyadmin");
    expect(normalizeSessionRole("venue-admin")).not.toBe("dispatcher");
    expect(normalizeSessionRole("TRANSIT_ADMIN")).toBe("transit_admin");
    expect(normalizeSessionRole("transit-supervisor")).toBe("transit_supervisor");
    expect(normalizeSessionRole("CALL_ASSIST_OPERATOR")).toBe("call_assist_operator");
    expect(normalizeSessionRole("call-assist-admin")).toBe("call_assist_admin");
    expect(normalizeSessionRole("CALL_ASSIST_OPERATOR")).not.toBe("dispatcher");
    expect(normalizeSessionRole("commsupervisor")).toBe("supervisor");
    expect(normalizeSessionRole("COMMSUPERVISOR")).toBe("supervisor");
  });

  it("campus product helpers derive k12 vs highered from role", () => {
    expect(campusProductFromRole("CAMPUS_ADMIN_HIGHERED")).toBe("higher_ed");
    expect(campusProductFromRole("campus_admin_k12")).toBe("k12");
    expect(campusProductFromRole("CAMPUS_ADMIN")).toBe("k12");
    expect(campusProductFromRole("campusadmin")).toBe("k12");
    expect(campusProductFromRole("dispatcher")).toBeNull();
    expect(campusRoleFamily("CAMPUS_DISPATCH_HIGHERED")).toBe("dispatch");
    expect(campusRoleFamily("campus_admin_k12")).toBe("admin");
    expect(campusMatrixRoleFromRole("campus_supervisor_highered")).toBe("CAMPUS_SUPERVISOR");
    expect(isCampusAdminRole("CAMPUS_ADMIN_HIGHERED")).toBe(true);
    expect(isCampusAdminRole("CAMPUS_SECURITY_K12")).toBe(false);
    expect(isCampusRoleToken("CAMPUS_FACULTY_K12")).toBe(true);
    expect(campusAssignableRolesForProduct("k12")).toEqual([
      "CAMPUS_ADMIN_K12",
      "CAMPUS_SUPERVISOR_K12",
      "CAMPUS_SECURITY_K12",
      "CAMPUS_DISPATCH_K12",
    ]);
    expect(campusAssignableRolesForProduct("higher_ed").every((r) => r.endsWith("_HIGHERED"))).toBe(
      true,
    );
    expect(CAMPUS_ASSIGNABLE_ROLES).toHaveLength(8);
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
    expect(resolveHospitalPortalDashboardHref("HOSPITAL_COORDINATOR")).toBe("/hospital-admin/dashboard");
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
