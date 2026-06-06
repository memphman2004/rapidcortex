import { describe, expect, it } from "vitest";
import type { UserRole } from "rapid-cortex-shared";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  defaultPermissionForRole,
  isRcsuperadminOnlyPermission,
} from "./permissions.js";
import {
  ROLE_ACCESS_MATRIX_V2,
  RCSUPERADMIN_ONLY_PERMISSIONS,
  type MatrixRole,
} from "./role-access-matrix-v2.js";

const MATRIX_ROLES = Object.keys(ROLE_ACCESS_MATRIX_V2) as MatrixRole[];

/** Hospital portal roles are defined outside the agency PDF matrix. */
const HOSPITAL_PORTAL_ONLY_PERMISSIONS = [
  "hospital_portal.view",
  "hospital_portal.capacity_update",
  "hospital_portal.users_manage",
  "hospital_portal.analytics_view",
] as const;

describe("Role Access Matrix v2.0 (PDF)", () => {
  it("DEFAULT_ROLE_PERMISSIONS matches ROLE_ACCESS_MATRIX_V2 for each matrix role", () => {
    for (const role of MATRIX_ROLES) {
      const allowed = new Set(ROLE_ACCESS_MATRIX_V2[role]);
      for (const p of ALL_PERMISSIONS) {
        if ((HOSPITAL_PORTAL_ONLY_PERMISSIONS as readonly string[]).includes(p)) {
          expect(defaultPermissionForRole(role, p)).toBe(false);
          continue;
        }
        expect(defaultPermissionForRole(role, p)).toBe(allowed.has(p));
      }
    }
  });

  it("grants rcsuperadmin-only immutable permissions to rcsuperadmin only", () => {
    for (const p of RCSUPERADMIN_ONLY_PERMISSIONS) {
      expect(isRcsuperadminOnlyPermission(p)).toBe(true);
      expect(defaultPermissionForRole("rcsuperadmin", p)).toBe(true);
      for (const role of MATRIX_ROLES) {
        expect(defaultPermissionForRole(role, p)).toBe(false);
      }
    }
  });

  it("agencyadmin cannot access live workspace or cross-tenant platform flags", () => {
    expect(defaultPermissionForRole("agencyadmin", "workspace.live_call")).toBe(false);
    expect(defaultPermissionForRole("agencyadmin", "system.tenant_mgmt")).toBe(false);
    expect(defaultPermissionForRole("agencyadmin", "billing.manage")).toBe(false);
    expect(defaultPermissionForRole("agencyadmin", "transcripts.view")).toBe(false);
  });

  it("dispatcher has transcripts and war-room join but not supervisor-only workspace", () => {
    expect(defaultPermissionForRole("dispatcher", "transcripts.view")).toBe(true);
    expect(defaultPermissionForRole("dispatcher", "command.war_room_join")).toBe(true);
    expect(defaultPermissionForRole("dispatcher", "workspace.silent_monitor")).toBe(false);
    expect(defaultPermissionForRole("dispatcher", "incidents.view_all")).toBe(false);
  });

  it("rcadmin cannot manage revenue or export billing", () => {
    expect(defaultPermissionForRole("rcadmin", "billing.revenue_view")).toBe(false);
    expect(defaultPermissionForRole("rcadmin", "billing.export")).toBe(false);
  });

  it("grants agency-scoped hospital routing and emergency connect coarse permissions", () => {
    expect(defaultPermissionForRole("agencyadmin", "emergency_connect.manage")).toBe(true);
    expect(defaultPermissionForRole("agencyadmin", "emergency_connect.view")).toBe(true);
    expect(defaultPermissionForRole("agencyadmin", "hospital_routing.manage")).toBe(true);
    expect(defaultPermissionForRole("supervisor", "emergency_connect.manage")).toBe(true);
    expect(defaultPermissionForRole("agencyit", "emergency_connect.view")).toBe(true);
    expect(defaultPermissionForRole("dispatcher", "emergency_connect.view")).toBe(true);
    expect(defaultPermissionForRole("dispatcher", "hospital_routing.view")).toBe(true);
    expect(defaultPermissionForRole("agencyit", "emergency_connect.manage")).toBe(false);
  });

  it("leaves hospital roles unchanged outside the PDF matrix", () => {
    expect(defaultPermissionForRole("hospitaladmin", "hospital_portal.view")).toBe(true);
    expect(defaultPermissionForRole("hospitaladmin", "incidents.view")).toBe(false);
    expect(defaultPermissionForRole("hospitalstaff", "hospital_portal.capacity_update")).toBe(true);
    expect(defaultPermissionForRole("hospitalstaff", "hospital_portal.users_manage")).toBe(false);
  });
});
