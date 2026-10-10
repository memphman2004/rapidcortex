import {
  campusRoleFamily,
  isCampusAdminRole,
  isRcInternalOperator,
  migrateLegacyRapidCortexRoleTokenValue,
} from "rapid-cortex-shared";

function family(role?: string): string | null {
  return campusRoleFamily(role) ?? null;
}

function sameAgency(targetAgencyId?: string, userAgencyId?: string): boolean {
  if (targetAgencyId && userAgencyId && targetAgencyId !== userAgencyId) return false;
  return true;
}

export function canCampusSecurityOrHigher(
  role?: string,
  targetAgencyId?: string,
  userAgencyId?: string,
): boolean {
  if (isRcInternalOperator(role ?? "")) return true;
  if (!sameAgency(targetAgencyId, userAgencyId)) return false;
  const f = family(role);
  return f === "admin" || f === "supervisor" || f === "security" || f === "dispatch";
}

export function canCampusSupervisorOrHigher(
  role?: string,
  targetAgencyId?: string,
  userAgencyId?: string,
): boolean {
  if (isRcInternalOperator(role ?? "")) return true;
  if (!sameAgency(targetAgencyId, userAgencyId)) return false;
  const f = family(role);
  return f === "admin" || f === "supervisor";
}

export function canCampusAdmin(
  role?: string,
  targetAgencyId?: string,
  userAgencyId?: string,
): boolean {
  if (isRcInternalOperator(role ?? "")) return true;
  if (!sameAgency(targetAgencyId, userAgencyId)) return false;
  return isCampusAdminRole(role);
}

export const canManageVisitors = (role?: string) => {
  const f = family(role);
  return f === "admin" || f === "supervisor" || f === "security" || f === "dispatch";
};

export const canWritePickupAuth = (role?: string) =>
  isRcInternalOperator(role ?? "") || isCampusAdminRole(role);

export const canReadPickupAuth = (role?: string) => {
  if (isRcInternalOperator(role ?? "")) return true;
  const f = family(role);
  return f === "admin" || f === "supervisor" || f === "security";
};

export const canViewCleryReport = (role?: string) => {
  if (isRcInternalOperator(role ?? "")) return true;
  // Clery is higher-ed; still allow admin/supervisor families (product pages gate separately).
  const f = family(role);
  return f === "admin" || f === "supervisor";
};

/** @deprecated Prefer campusRoleFamily — kept for any callers using migrate only. */
export function normalizeCampusRoleToken(role?: string): string {
  return (migrateLegacyRapidCortexRoleTokenValue(role ?? "") ?? role ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}
