import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";

export const SALES_CONTRACTOR_ROLE = "salescontractor" as const;
const OVERSIGHT = new Set(["rcadmin"]);

function role(u: Pick<UserContext, "role">): string {
  const r = String(u.role ?? "").trim();
  return migrateLegacyRapidCortexRoleTokenValue(r) ?? r;
}

export function isSalesContractor(u: Pick<UserContext, "role">): boolean {
  return role(u) === SALES_CONTRACTOR_ROLE;
}

function hasOversight(u: Pick<UserContext, "role">): boolean {
  return OVERSIGHT.has(role(u));
}

export function canViewPipeline(u: UserContext): boolean {
  return isRcsuperadmin(u) || isSalesContractor(u) || hasOversight(u);
}

export function canManageLead(u: UserContext): boolean {
  return isRcsuperadmin(u) || isSalesContractor(u) || hasOversight(u);
}

export function canViewEarnings(u: UserContext): boolean {
  return isRcsuperadmin(u) || isSalesContractor(u) || hasOversight(u);
}

export function earningsScopedToSelf(u: UserContext): boolean {
  return !isRcsuperadmin(u) && !hasOversight(u) && isSalesContractor(u);
}

export function isBlockedFromAgencyOps(u: UserContext): boolean {
  return !isRcsuperadmin(u) && isSalesContractor(u);
}
