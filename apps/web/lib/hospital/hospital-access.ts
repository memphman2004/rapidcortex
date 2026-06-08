/**
 * apps/web/lib/hospital/hospital-access.ts
 *
 * Access control for all hospital portal routes.
 * HOSPITAL_ADMIN and HOSPITAL_COORDINATOR share most pages,
 * but differ on edit rights and access to /users + /settings.
 * RC internal roles bypass all gates (cross-tenant support).
 */

import type { UserContext } from "rapid-cortex-shared/types";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";

// ─── Role predicates ──────────────────────────────────────────────────────────

export function isHospitalAdminRole(role: string): boolean {
  return role === "HOSPITAL_ADMIN" || role === "hospitaladmin";
}

export function isHospitalCoordinatorRole(role: string): boolean {
  return role === "HOSPITAL_COORDINATOR";
}

export function isHospitalStaffRole(role: string): boolean {
  return role === "HOSPITAL_STAFF" || role === "hospitalstaff";
}

export function isAnyHospitalRole(role: string): boolean {
  return isHospitalAdminRole(role) || isHospitalCoordinatorRole(role) || isHospitalStaffRole(role);
}

// ─── Page-level gates ─────────────────────────────────────────────────────────

/**
 * Can view the hospital admin portal at all.
 * Admin + Coordinator + RC internal.
 * Staff have their own /hospital-staff portal.
 */
export function canAccessHospitalAdminPortal(user: UserContext): boolean {
  if (isRcInternalOperator(user.role)) return true;
  return isHospitalAdminRole(user.role) || isHospitalCoordinatorRole(user.role);
}

/**
 * Admin-only pages: /users, /settings.
 * Coordinator is redirected to dashboard if they hit these directly.
 */
export function canAccessHospitalAdminOnlyRoutes(user: UserContext): boolean {
  if (isRcInternalOperator(user.role)) return true;
  return isHospitalAdminRole(user.role);
}

/**
 * Can update capacity for a facility.
 * Admin, Coordinator, and Staff can all update capacity.
 */
export function canUpdateHospitalCapacity(user: UserContext): boolean {
  if (isRcInternalOperator(user.role)) return true;
  return isAnyHospitalRole(user.role);
}

/**
 * Can modify routing configuration (diversion thresholds, EMS rules).
 * Admin and RC internal only — coordinator gets view-only.
 */
export function canEditRoutingConfig(user: UserContext): boolean {
  if (isRcInternalOperator(user.role)) return true;
  return isHospitalAdminRole(user.role);
}

/**
 * Can export analytics data.
 * Admin and RC internal only.
 */
export function canExportHospitalAnalytics(user: UserContext): boolean {
  if (isRcInternalOperator(user.role)) return true;
  return isHospitalAdminRole(user.role);
}

// ─── Redirect targets ─────────────────────────────────────────────────────────

export function hospitalPostAuthRedirect(role: string): string {
  if (isHospitalAdminRole(role) || isHospitalCoordinatorRole(role)) {
    return "/hospital-admin/dashboard";
  }
  if (isHospitalStaffRole(role)) {
    return "/hospital-staff/dashboard";
  }
  return "/auth/signout";
}

// ─── Role display ─────────────────────────────────────────────────────────────

export function hospitalRoleBadge(role: string): string {
  if (isHospitalAdminRole(role)) return "FACILITY ADMIN";
  if (isHospitalCoordinatorRole(role)) return "COORDINATOR";
  if (isHospitalStaffRole(role)) return "STAFF";
  return "HOSPITAL";
}

export function hospitalRoleDescription(role: string): string {
  if (isHospitalAdminRole(role)) {
    return "Facility configuration, routing, user management, and analytics.";
  }
  if (isHospitalCoordinatorRole(role)) {
    return "Capacity management, regional routing overview, and EMS coordination.";
  }
  return "Capacity updates for your facility.";
}
