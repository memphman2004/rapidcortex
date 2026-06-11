import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";

const RC_PLATFORM_ROLES = new Set(["rcsuperadmin", "rcadmin", "rcitadmin"]);

const MANAGE_ROLES = new Set([
  ...RC_PLATFORM_ROLES,
  "agencyadmin",
  "campus_admin",
  "venue_admin",
]);

function effectiveRole(user: UserContext): string {
  return migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
}

export function canManageSmsRouting(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  const role = effectiveRole(user);
  if (!MANAGE_ROLES.has(role)) return false;
  if (RC_PLATFORM_ROLES.has(role)) return true;
  return user.agencyId === agencyId;
}

export function canViewSmsRouting(user: UserContext, agencyId: string): boolean {
  return canManageSmsRouting(user, agencyId);
}
