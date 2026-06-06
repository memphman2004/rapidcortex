import { describe, expect, it } from "vitest";
import { canViewSensitiveData, isAdminRole, isAuditRole, isSupervisorOrAdmin } from "rapid-cortex-security";

describe("RBAC helpers (production readiness)", () => {
  it("isAuditRole identifies analyst and auditor", () => {
    expect(isAuditRole("analyst")).toBe(true);
    expect(isAuditRole("auditor")).toBe(true);
    expect(isAuditRole("dispatcher")).toBe(false);
  });

  it("canViewSensitiveData gates analyst with admin/supervisor tiers", () => {
    expect(canViewSensitiveData("analyst")).toBe(true);
    expect(canViewSensitiveData("auditor")).toBe(false);
    expect(canViewSensitiveData("dispatcher")).toBe(false);
    expect(canViewSensitiveData("agencyadmin")).toBe(true);
    expect(canViewSensitiveData("commsupervisor")).toBe(true);
    expect(canViewSensitiveData("agencyit")).toBe(true);
  });

  it("isSupervisorOrAdmin excludes agencyit (operational supervisory surface only)", () => {
    expect(isSupervisorOrAdmin("commsupervisor")).toBe(true);
    expect(isSupervisorOrAdmin("agencyadmin")).toBe(true);
    expect(isSupervisorOrAdmin("agencyit")).toBe(false);
  });

  it("isAdminRole includes agencyit for admin HTTP routes", () => {
    expect(isAdminRole("agencyit")).toBe(true);
    expect(isAdminRole("dispatcher")).toBe(false);
    expect(isAdminRole("rcadmin")).toBe(true);
    expect(isAdminRole("rcitadmin")).toBe(true);
    /**
     * RC platform roles (rcadmin / rcsuperadmin / rcitadmin) all flow through `isRcStaff`
     * inside `isSupervisorOrAbove`, so they MUST be considered supervisor-or-admin.
     */
    expect(isSupervisorOrAdmin("rcadmin")).toBe(true);
    expect(isSupervisorOrAdmin("rcsuperadmin")).toBe(true);
    expect(isSupervisorOrAdmin("rcitadmin")).toBe(true);
  });
});
