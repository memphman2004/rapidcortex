/**
 * Access control helpers for campus admin-only routes.
 * All route guards use these — no inline string comparisons on page files.
 */

import type { AgencyTenant, CampusInstitutionType } from "rapid-cortex-shared";
import {
  CAMPUS_ASSIGNABLE_ROLES as SHARED_CAMPUS_ROLES,
  campusAssignableRolesForProduct,
  isCampusAdminRole,
  ROLE_LABELS,
} from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { CampusAssignableRole as SharedCampusRole } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";
import { resolveAgencyVerticalFromTenant } from "@/lib/vertical";

export const CAMPUS_ADMIN_ONLY_NAV_KEYS = ["users", "settings"] as const;

/** Org code embedded in campus agencyIds (e.g. test-campus-lincoln-high → LINCOLNHIGH). */
export function extractCampusCode(agencyId: string): string {
  const raw = agencyId.trim();
  const match = raw.match(/(?:test-)?campus-(.+)$/i);
  return (match?.[1] ?? raw).toUpperCase().replace(/-/g, "");
}

/** Roles that may access campus admin routes (/users, /settings). */
export function canAccessCampusAdminRoutes(
  user: Pick<UserContext, "role" | "agencyId">,
  campusAgencyId: string,
): boolean {
  if (isRcInternalOperator(user.role)) return true;
  if (!isCampusAdminRole(user.role)) return false;
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

/** Campus admin (either product) for matching campus code, or RC internal operators. */
export function canAccessCampusUsersOrSettings(
  user: Pick<UserContext, "role" | "agencyId"> | null | undefined,
  campusCode: string,
): boolean {
  if (!user?.role) return false;
  if (isRcInternalOperator(user.role)) return true;
  if (!isCampusAdminRole(user.role)) return false;
  const userCode = userCampusCode(user);
  if (!userCode) return false;
  return userCode === normalizeCampusCode(campusCode);
}

export function isCampusAssignableRole(role: string): boolean {
  return (SHARED_CAMPUS_ROLES as readonly string[]).includes(role);
}

const ROLE_PICKER_META: Record<
  SharedCampusRole,
  { label: string; description: string; color: string }
> = {
  CAMPUS_ADMIN_K12: {
    label: "Campus Admin (K-12)",
    description: "Full admin — school safety, visitors, users, settings",
    color: "bg-slate-600 text-white",
  },
  CAMPUS_SUPERVISOR_K12: {
    label: "Campus Supervisor (K-12)",
    description: "Incident oversight, school safety reports",
    color: "bg-slate-700 text-slate-200",
  },
  CAMPUS_SECURITY_K12: {
    label: "Campus Security (K-12)",
    description: "Incident response, visitor verification",
    color: "bg-slate-800 text-slate-300",
  },
  CAMPUS_DISPATCH_K12: {
    label: "Campus Dispatch (K-12)",
    description: "Incident queue management",
    color: "bg-slate-800 text-slate-300",
  },
  CAMPUS_ADMIN_HIGHERED: {
    label: "Campus Admin (Higher-ed)",
    description: "Full admin — Clery, QR, users, settings, incidents",
    color: "bg-slate-600 text-white",
  },
  CAMPUS_SUPERVISOR_HIGHERED: {
    label: "Campus Supervisor (Higher-ed)",
    description: "Incident oversight, reports, QR view",
    color: "bg-slate-700 text-slate-200",
  },
  CAMPUS_SECURITY_HIGHERED: {
    label: "Campus Security (Higher-ed)",
    description: "Incident response, QR view",
    color: "bg-slate-800 text-slate-300",
  },
  CAMPUS_DISPATCH_HIGHERED: {
    label: "Campus Dispatch (Higher-ed)",
    description: "Incident queue management",
    color: "bg-slate-800 text-slate-300",
  },
};

/**
 * Campus roles available in the invite role picker for a given product.
 * Defaults to both products when product is omitted (RC tooling).
 */
export function campusAssignableRoleOptions(product?: CampusInstitutionType) {
  const values = product
    ? campusAssignableRolesForProduct(product)
    : [...SHARED_CAMPUS_ROLES];
  return values.map((value) => ({
    value,
    label: ROLE_PICKER_META[value]?.label ?? ROLE_LABELS[value.toLowerCase()] ?? value,
    description: ROLE_PICKER_META[value]?.description ?? "",
  }));
}

/**
 * Campus roles available in the invite role picker.
 * PSAP and RC roles must never appear here.
 * @deprecated Prefer {@link campusAssignableRoleOptions} with agency institutionType.
 */
export const CAMPUS_ASSIGNABLE_ROLES = campusAssignableRoleOptions() as ReadonlyArray<{
  value: SharedCampusRole;
  label: string;
  description: string;
}>;

export type CampusAssignableRole = SharedCampusRole;

export const CAMPUS_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  SHARED_CAMPUS_ROLES.map((r) => [r, ROLE_PICKER_META[r].label]),
);

export const CAMPUS_ROLE_COLORS: Record<string, string> = Object.fromEntries(
  SHARED_CAMPUS_ROLES.map((r) => [r, ROLE_PICKER_META[r].color]),
);

/** Shared package role union for API validation. */
export type CampusRoleToken = SharedCampusRole;
