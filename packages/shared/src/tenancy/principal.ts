import { migrateLegacyRapidCortexRoleTokenValue } from "../auth/rapid-cortex-roles.js";
import type { AgencyRole, UserContext, UserRole } from "../types.js";
import { PLATFORM_AGENCY_ID } from "./constants.js";

function effective(role: UserRole | string): string {
  return migrateLegacyRapidCortexRoleTokenValue(String(role).trim()) ?? String(role).trim();
}

/** Role-only RC super-admin check (legacy JWT literals normalize via migration). */
export function isPlatformAdmin(role: UserRole | string): boolean {
  return effective(role) === "rcsuperadmin";
}

/**
 * True for Rapid Cortex full platform operators (`rcsuperadmin`) or sentinel platform tenant JWTs
 * on `__platform__` (legacy pools).
 */
export function isRcsuperadmin(user: Pick<UserContext, "role" | "agencyId">): boolean {
  const effectiveRole = effective(user.role);
  return effectiveRole === "rcsuperadmin" || user.agencyId === PLATFORM_AGENCY_ID;
}

/** @deprecated Use {@link isRcsuperadmin} — alias retained for incremental migration of imports. */
export const isRcAdmin = isRcsuperadmin;

export function isRcInternalOperator(role: UserRole | string): boolean {
  const e = effective(role);
  return e === "rcsuperadmin" || e === "rcadmin" || e === "rcitadmin";
}

/**
 * Billing contracts, add-ons, and procurement — all RC internal operators.
 */
export function canAccessRcFinancePortal(role: UserRole | string): boolean {
  const e = effective(role);
  return e === "rcadmin" || e === "rcsuperadmin" || e === "rcitadmin";
}

/** Revenue / MRR totals — rcsuperadmin only (Role Access Matrix v2). */
export function canAccessRcRevenuePortal(role: UserRole | string): boolean {
  return effective(role) === "rcsuperadmin";
}

/** Usage / telemetry dashboards for RC staff. */
export function canAccessRcUsagePortal(role: UserRole | string): boolean {
  const e = effective(role);
  return e === "rcadmin" || e === "rcsuperadmin" || e === "rcitadmin";
}

export function isAgencyRole(role: UserContext["role"]): role is AgencyRole {
  const e = effective(role);
  return (
    e === "dispatcher" ||
    e === "supervisor" ||
    e === "agencyadmin" ||
    e === "agencyit" ||
    e === "analyst" ||
    e === "auditor"
  );
}
