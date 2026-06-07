import {
  HOSPITAL_ASSIGNABLE_ROLES,
  migrateLegacyRapidCortexRoleTokenValue,
  type HospitalAssignableRole,
} from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isAgencyRole, isRcInternalOperator, isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import type { AgencyRole, UserContext, UserRole } from "rapid-cortex-shared/types";
import {
  ALL_PERMISSIONS,
  defaultPermissionForRole,
  isRcitadminCrossTenantPermission,
  type Permission,
} from "./permissions.js";
import { CAMPUS_ROLE_BASE_MAP, canCampusRolePerform, canVenueRolePerform, isCampusRole, isVenueRole } from "./role-access-matrix-v2.js";

function resolveRoleAlias(role: UserRole | string): UserRole {
  const raw = String(role ?? "").trim();
  const campusMapped = CAMPUS_ROLE_BASE_MAP[raw as keyof typeof CAMPUS_ROLE_BASE_MAP];
  if (campusMapped) return campusMapped;
  return (migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw) as UserRole;
}

/**
 * Central RBAC checks — mirror in UI route guards and API handlers.
 */
export class AuthorizationService {
  canAccessAdminRoutes(user: UserContext): boolean {
    return user.role === "agencyadmin" || user.role === "agencyit" || isRcsuperadmin(user);
  }

  /** Operational supervisor workspaces (dispatcher oversight). */
  canAccessSupervisorRoutes(user: UserContext): boolean {
    const role =
      migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
    return (
      role === "supervisor" ||
      role === "agencyadmin" ||
      isRcsuperadmin(user)
    );
  }

  canDispatch(user: UserContext): boolean {
    return this.isKnownRole(user.role);
  }

  /** Platform agency list/create — RC internal operators (not agency tenants). */
  canManageAgencies(user: UserContext): boolean {
    return isRcsuperadmin(user) || isRcInternalOperator(user.role);
  }

  canCreateInvite(user: UserContext, targetAgencyId: string): boolean {
    if (isRcsuperadmin(user)) return true;
    return user.role === "agencyadmin" && user.agencyId === targetAgencyId;
  }

  assertAgencyAdminManagingSameAgency(user: UserContext, targetAgencyId: string): void {
    if (isRcsuperadmin(user)) return;
    if (user.role === "agencyadmin" && user.agencyId === targetAgencyId) return;
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  assertAssignableAgencyRole(role: AgencyRole): void {
    if (!isAgencyRole(role)) {
      const err = new Error("INVALID_ROLE");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
  }

  assertAssignableHospitalRole(role: HospitalAssignableRole): void {
    if (!(HOSPITAL_ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
      const err = new Error("INVALID_ROLE");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
  }

  canManageHospitalUsers(user: UserContext, hospitalId: string): boolean {
    if (isRcsuperadmin(user)) return true;
    if (user.role === "agencyadmin" && user.agencyId) return true;
    const role = migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
    if (
      role === "hospitaladmin" &&
      user.hospitalId === hospitalId &&
      user.agencyId
    ) {
      return true;
    }
    return false;
  }

  requireRole(user: UserContext, allowed: UserRole[]): void {
    if (isRcsuperadmin(user)) return;
    if (!allowed.includes(user.role)) {
      const err = new Error("FORBIDDEN_ROLE");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  /**
   * Boolean form of {@link assertCanPerform}. Returns `true` when the caller's
   * role grants the named permission per Role Access Matrix v2.0, with two
   * elevation rules baked in:
   *
   *   1. `rcsuperadmin` is the universal escape hatch (always `true`).
   *   2. `rcitadmin` is granted the cross-tenant slice enumerated in
   *      {@link RCITADMIN_CROSS_TENANT_PERMISSIONS} regardless of agency
   *      boundary. (Agency-scoped helpers like {@link AgencyScopeResolver}
   *      remain responsible for tenant filtering on the data itself.)
   *
   * Mirror this check in UI route guards so the server-side denial path is
   * never the first signal a user sees.
   */
  canPerform(user: UserContext, permission: Permission | string): boolean {
    if (isRcsuperadmin(user)) return true;
    const permissionKey = String(permission);
    const rawRole = String(user.role ?? "").trim();
    if (isCampusRole(rawRole) && (permissionKey.startsWith("campus.") || permissionKey.startsWith("locations."))) {
      return canCampusRolePerform(rawRole, permissionKey);
    }
    if (isVenueRole(rawRole) && permissionKey.startsWith("locations.")) {
      return canVenueRolePerform(rawRole, permissionKey);
    }
    if (!(ALL_PERMISSIONS as readonly string[]).includes(permissionKey)) return false;
    const typedPermission = permissionKey as Permission;
    const role = resolveRoleAlias(user.role);
    if (role === "rcitadmin" && isRcitadminCrossTenantPermission(typedPermission)) return true;
    return defaultPermissionForRole(role, typedPermission);
  }

  /**
   * Fine-grained permission gate intended at the entry point of every HTTP /
   * Lambda handler that mutates or reads sensitive tenant data. Throws a
   * 403-shaped error (`statusCode = 403`, `message = "FORBIDDEN_PERMISSION"`)
   * when {@link canPerform} returns `false`. The thrown error carries a
   * `permission` field so audit logs / handler error mappers can record which
   * permission was denied without leaking the matrix to the response body.
   *
   * @example
   *   const auth = new AuthorizationService();
   *   auth.assertCanPerform(user, "qa.scorecards_create");
   *   // ... proceed with handler logic
   */
  assertCanPerform(user: UserContext, permission: Permission | string): void {
    if (this.canPerform(user, permission)) return;
    const err = new Error("FORBIDDEN_PERMISSION") as Error & {
      statusCode?: number;
      permission?: string;
    };
    err.statusCode = 403;
    err.permission = String(permission);
    throw err;
  }

  private isKnownRole(role: UserRole): boolean {
    const e = resolveRoleAlias(role);
    return (
      e === "dispatcher" ||
      e === "supervisor" ||
      e === "agencyadmin" ||
      e === "agencyit" ||
      e === "analyst" ||
      e === "auditor" ||
      e === "rcsuperadmin" ||
      e === "rcadmin" ||
      e === "rcitadmin" ||
      e === "hospitaladmin" ||
      e === "hospitalstaff"
    );
  }
}
