import { migrateLegacyRapidCortexRoleTokenValue, isRcInternalOperator } from "rapid-cortex-shared";

function norm(role?: string): string {
  return (migrateLegacyRapidCortexRoleTokenValue(role ?? "") ?? role ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

export function canCampusSecurityOrHigher(
  role?: string,
  targetAgencyId?: string,
  userAgencyId?: string,
): boolean {
  if (isRcInternalOperator(role ?? "")) return true;
  if (targetAgencyId && userAgencyId && targetAgencyId !== userAgencyId) return false;
  const r = norm(role);
  return ["campus_admin", "campus_supervisor", "campus_security", "campus_dispatch"].includes(r);
}

export function canCampusSupervisorOrHigher(
  role?: string,
  targetAgencyId?: string,
  userAgencyId?: string,
): boolean {
  if (isRcInternalOperator(role ?? "")) return true;
  if (targetAgencyId && userAgencyId && targetAgencyId !== userAgencyId) return false;
  const r = norm(role);
  return ["campus_admin", "campus_supervisor"].includes(r);
}

export function canCampusAdmin(
  role?: string,
  targetAgencyId?: string,
  userAgencyId?: string,
): boolean {
  if (isRcInternalOperator(role ?? "")) return true;
  if (targetAgencyId && userAgencyId && targetAgencyId !== userAgencyId) return false;
  return norm(role) === "campus_admin";
}

export const canManageVisitors = (role?: string) =>
  ["campus_admin", "campus_supervisor", "campus_security", "campus_dispatch"].includes(norm(role));

export const canWritePickupAuth = (role?: string) =>
  isRcInternalOperator(role ?? "") || norm(role) === "campus_admin";

export const canReadPickupAuth = (role?: string) =>
  isRcInternalOperator(role ?? "") ||
  ["campus_admin", "campus_supervisor", "campus_security"].includes(norm(role));

export const canViewCleryReport = (role?: string) =>
  isRcInternalOperator(role ?? "") ||
  ["campus_admin", "campus_supervisor"].includes(norm(role));
