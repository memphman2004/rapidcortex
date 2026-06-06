import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AGENCY_ASSIGNABLE_ROLES,
  HOSPITAL_ASSIGNABLE_ROLES,
  RAPID_CORTEX_ROLES,
  migrateLegacyRapidCortexRoleTokenValue,
  ROLE_DISPLAY_LABELS,
  isHospitalPortalRole,
  isRapidCortexRole,
} from "./rapid-cortex-roles.js";
import { USER_ROLE_SCHEMA } from "../types.js";

describe("rapid-cortex-roles", () => {
  it("defines the canonical role list", () => {
    expect([...RAPID_CORTEX_ROLES]).toEqual([
      "rcsuperadmin",
      "rcadmin",
      "rcitadmin",
      "agencyadmin",
      "agencyit",
      "supervisor",
      "dispatcher",
      "analyst",
      "auditor",
      "hospitaladmin",
      "hospitalstaff",
    ]);
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
    expect(migrateLegacyRapidCortexRoleTokenValue("staff")).toBe("auditor");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_ADMIN")).toBe("agencyadmin");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_SUPERVISOR")).toBe("supervisor");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_SECURITY")).toBe("dispatcher");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_DISPATCH")).toBe("dispatcher");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_COUNSELOR")).toBe("analyst");
    expect(migrateLegacyRapidCortexRoleTokenValue("CAMPUS_FACULTY")).toBe("auditor");
    expect(migrateLegacyRapidCortexRoleTokenValue(undefined)).toBeUndefined();
  });

  it("isHospitalPortalRole accepts canonical and legacy hospital roles", () => {
    expect(isHospitalPortalRole("hospitaladmin")).toBe(true);
    expect(isHospitalPortalRole("hospitalstaff")).toBe(true);
    expect(isHospitalPortalRole("hospital_admin")).toBe(true);
    expect(isHospitalPortalRole("dispatcher")).toBe(false);
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
