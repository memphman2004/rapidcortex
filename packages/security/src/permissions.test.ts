import { describe, expect, it } from "vitest";
import type { UserRole } from "rapid-cortex-shared";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  RCITADMIN_CROSS_TENANT_PERMISSIONS,
  defaultPermissionForRole,
  isImmutableRolePermissionRole,
  isRcitadminCrossTenantPermission,
  roleMayDeleteTranscripts,
  type Permission,
} from "./permissions.js";
import { ROLE_ACCESS_MATRIX_V2 } from "./role-access-matrix-v2.js";

const PRODUCT_ROLES: UserRole[] = [
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
];

describe("DEFAULT_ROLE_PERMISSIONS", () => {
  it("includes every UserRole with a full permission map", () => {
    for (const role of PRODUCT_ROLES) {
      const row = DEFAULT_ROLE_PERMISSIONS[role];
      expect(row, role).toBeDefined();
      for (const p of ALL_PERMISSIONS) {
        expect(typeof row[p]).toBe("boolean");
      }
    }
  });

  it("grants transcripts.delete only to rcsuperadmin", () => {
    for (const role of PRODUCT_ROLES) {
      const allowed = defaultPermissionForRole(role, "transcripts.delete");
      expect(allowed).toBe(role === "rcsuperadmin");
      expect(roleMayDeleteTranscripts(role)).toBe(role === "rcsuperadmin");
    }
  });

  it("marks rcsuperadmin default matrix immutable for admin tooling", () => {
    expect(isImmutableRolePermissionRole("rcsuperadmin")).toBe(true);
    expect(isImmutableRolePermissionRole("rcadmin")).toBe(false);
  });

  it("grants rcadmin only the v2.0 matrix slice", () => {
    for (const p of ALL_PERMISSIONS) {
      const want = (ROLE_ACCESS_MATRIX_V2.rcadmin as readonly string[]).includes(p);
      expect(defaultPermissionForRole("rcadmin", p)).toBe(want);
    }
  });

  it("lists rcitadmin cross-tenant permissions consistently with the guard allowlist", () => {
    for (const p of RCITADMIN_CROSS_TENANT_PERMISSIONS) {
      expect(isRcitadminCrossTenantPermission(p)).toBe(true);
    }
    expect(isRcitadminCrossTenantPermission("incidents.view")).toBe(false);
    expect(isRcitadminCrossTenantPermission("analysis.view")).toBe(false);
    expect(isRcitadminCrossTenantPermission("transcripts.view")).toBe(false);
  });
});
