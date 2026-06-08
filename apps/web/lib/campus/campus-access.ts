/**
 * Access control helpers for campus admin-only routes.
 * All route guards use these — no inline string comparisons on page files.
 */

import type { AgencyTenant } from "rapid-cortex-shared";
import { CAMPUS_ASSIGNABLE_ROLES as SHARED_CAMPUS_ROLES } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { CampusAssignableRole as SharedCampusRole } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";
import { extractCampusCode } from "@/lib/auth/post-login-redirect";
import { resolveAgencyVerticalFromTenant } from "@/lib/vertical";

export const CAMPUS_ADMIN_ONLY_NAV_KEYS = ["users", "settings"] as const;

const CAMPUS_ADMIN_ROLES = new Set(["CAMPUS_ADMIN"]);

/** Roles that may access campus admin routes (/users, /settings). */
export function canAccessCampusAdminRoutes(
  user: Pick<UserContext, "role" | "agencyId">,
  campusAgencyId: string,
): boolean {
  if (isRcInternalOperator(user.role)) return true;
  if (!CAMPUS_ADMIN_ROLES.has(user.role.trim().toUpperCase())) return false;
  return user.agencyId === campusAgencyId;
}

/** Org code embedded in campus agencyIds (e.g. test-campus-lincoln-high → LINCOLNHIGH). */
export function campusOrgCodeFromAgencyId(agencyId: string): string {
  return extractCampusCode(agencyId);
}

export function normalizeCampusCode(code: string): string {
  return code.trim().toUpperCase().replace(/-/g, "");
}

/** Resolve Dynamo agencyId for `/app/campus/{code}` routes. */
export function resolveCampusAgencyIdFromCode(
  agencies: readonly AgencyTenant[],
  campusCode: string,
): string | null {
  const target = normalizeCampusCode(campusCode);
  for (const agency of agencies) {
    const vertical = resolveAgencyVerticalFromTenant(agency);
    if (vertical !== "campus" && agency.type !== "campus") continue;
    if (campusOrgCodeFromAgencyId(agency.agencyId) === target) return agency.agencyId;
  }
  return null;
}

export function userCampusCode(user: Pick<UserContext, "agencyId">): string | null {
  const agencyId = user.agencyId?.trim();
  if (!agencyId) return null;
  return campusOrgCodeFromAgencyId(agencyId);
}

/** CAMPUS_ADMIN for matching campus code, or RC internal operators (cross-tenant). */
export function canAccessCampusUsersOrSettings(
  user: Pick<UserContext, "role" | "agencyId"> | null | undefined,
  campusCode: string,
): boolean {
  if (!user?.role) return false;
  if (isRcInternalOperator(user.role)) return true;
  if (user.role.toUpperCase() !== "CAMPUS_ADMIN") return false;
  const userCode = userCampusCode(user);
  if (!userCode) return false;
  return userCode === normalizeCampusCode(campusCode);
}

export function isCampusAssignableRole(role: string): boolean {
  return (SHARED_CAMPUS_ROLES as readonly string[]).includes(role);
}

/**
 * Campus roles available in the invite role picker.
 * PSAP and RC roles must never appear here.
 */
export const CAMPUS_ASSIGNABLE_ROLES = [
  {
    value: "CAMPUS_ADMIN",
    label: "Campus Admin",
    description: "Full admin — QR, users, settings, incidents",
  },
  {
    value: "CAMPUS_SUPERVISOR",
    label: "Campus Supervisor",
    description: "Incident oversight, reports, QR view",
  },
  {
    value: "CAMPUS_SECURITY",
    label: "Campus Security",
    description: "Incident response, QR view",
  },
  {
    value: "CAMPUS_DISPATCH",
    label: "Campus Dispatch",
    description: "Incident queue management",
  },
] as const;

export type CampusAssignableRole = (typeof CAMPUS_ASSIGNABLE_ROLES)[number]["value"];

export const CAMPUS_ROLE_LABELS: Record<CampusAssignableRole, string> = {
  CAMPUS_ADMIN: "Campus Admin",
  CAMPUS_SUPERVISOR: "Supervisor",
  CAMPUS_SECURITY: "Security",
  CAMPUS_DISPATCH: "Dispatch",
};

export const CAMPUS_ROLE_COLORS: Record<CampusAssignableRole, string> = {
  CAMPUS_ADMIN: "bg-slate-600 text-white",
  CAMPUS_SUPERVISOR: "bg-slate-700 text-slate-200",
  CAMPUS_SECURITY: "bg-slate-800 text-slate-300",
  CAMPUS_DISPATCH: "bg-slate-800 text-slate-300",
};

/** Shared package role union for API validation. */
export type CampusRoleToken = SharedCampusRole;
