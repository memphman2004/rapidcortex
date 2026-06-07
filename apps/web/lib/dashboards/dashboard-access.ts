import type { UserContext, UserRole } from "rapid-cortex-shared/types";
import {
  isHospitalAdminPortalRole,
  isHospitalStaffPortalRole,
  migrateLegacyRapidCortexRoleTokenValue,
} from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import { jurisdictionRoleHomeHref } from "@/lib/auth/role-home";
import { getAdditionalDashboardPrefixes } from "./access-overrides";

/** URL prefix segment (first path segment) for each role dashboard area. */
export type DashboardPrefix =
  | "rc-admin"
  | "agency-admin"
  | "dispatcher"
  | "supervisor"
  | "qa"
  | "it-security"
  | "executive"
  | "hospital-admin"
  | "hospital-staff";

export const DASHBOARD_PREFIX_BY_ROLE: Record<UserRole, DashboardPrefix | null> = {
  rcsuperadmin: "rc-admin",
  rcadmin: "rc-admin",
  rcitadmin: "rc-admin",
  agencyadmin: "agency-admin",
  dispatcher: "dispatcher",
  supervisor: "supervisor",
  analyst: "qa",
  agencyit: "it-security",
  auditor: "executive",
  hospitaladmin: "hospital-admin",
  hospitalstaff: "hospital-staff",
};

export const ROLES_BY_DASHBOARD_PREFIX: Record<DashboardPrefix, readonly UserRole[]> = {
  "rc-admin": ["rcsuperadmin", "rcadmin", "rcitadmin"],
  "agency-admin": ["agencyadmin", "rcsuperadmin", "rcadmin", "rcitadmin"],
  dispatcher: ["dispatcher"],
  supervisor: ["supervisor"],
  qa: ["analyst"],
  "it-security": ["agencyit"],
  executive: ["auditor"],
  "hospital-admin": ["hospitaladmin", "rcsuperadmin", "rcadmin", "rcitadmin"],
  "hospital-staff": ["hospitalstaff", "rcsuperadmin", "rcadmin", "rcitadmin"],
};

export function dashboardPrefixFromPathname(pathname: string): DashboardPrefix | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (
    seg === "rc-admin" ||
    seg === "agency-admin" ||
    seg === "dispatcher" ||
    seg === "supervisor" ||
    seg === "qa" ||
    seg === "it-security" ||
    seg === "executive" ||
    seg === "hospital-admin" ||
    seg === "hospital-staff"
  ) {
    return seg;
  }
  return null;
}

export function isRoleDashboardPath(pathname: string): boolean {
  return dashboardPrefixFromPathname(pathname) !== null;
}

export function userMayAccessDashboardPrefix(
  user: Pick<UserContext, "role" | "agencyId">,
  prefix: DashboardPrefix,
): boolean {
  if (isRcsuperadmin(user)) return true;
  if (prefix === "hospital-admin" && isHospitalAdminPortalRole(user.role)) return true;
  if (prefix === "hospital-staff" && isHospitalStaffPortalRole(user.role)) return true;
  const effectiveRole = migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
  const base = (ROLES_BY_DASHBOARD_PREFIX[prefix] as readonly string[]).includes(effectiveRole);
  if (base) return true;
  const fullUser = user as UserContext;
  return getAdditionalDashboardPrefixes(fullUser).includes(prefix);
}

export type DashboardGateResult = "ok" | "unauthenticated" | "forbidden";

export function evaluateDashboardGate(
  user: UserContext | null,
  prefix: DashboardPrefix,
): DashboardGateResult {
  if (!user) return "unauthenticated";
  if (!userMayAccessDashboardPrefix(user, prefix)) return "forbidden";
  return "ok";
}

/** Default home after login — jurisdiction-scoped operational route per role. */
export function defaultDashboardHrefForRole(role: UserRole, jurisdictionSlug: string): string {
  return jurisdictionRoleHomeHref(role, jurisdictionSlug);
}

/** Use after sign-in or when forcing the canonical home for a role. */
export function postLoginDashboardHref(role: UserRole, jurisdictionSlug: string): string {
  return defaultDashboardHrefForRole(role, jurisdictionSlug);
}
