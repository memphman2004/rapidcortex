import { isRcInternalOperator, isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";

const RC_PLATFORM_ROLES = new Set(["rcsuperadmin", "rcadmin", "rcitadmin"]);

/** Roles that may create or deactivate QR codes (permission matrix v2). */
const MANAGE_ROLES = new Set([
  ...RC_PLATFORM_ROLES,
  "agencyadmin",
  "campus_admin",
  "venue_admin",
]);

/** Roles that may list, view, and download QR assets. */
const VIEW_ROLES = new Set([
  ...MANAGE_ROLES,
  "campus_supervisor",
  "venue_supervisor",
  "supervisor",
]);

function effectiveRole(user: UserContext): string {
  return migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
}

export function isQrNfcPlatformRole(role: string): boolean {
  return RC_PLATFORM_ROLES.has(role);
}

export function canCreateQrNfcCodes(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  const role = effectiveRole(user);
  if (!MANAGE_ROLES.has(role)) return false;
  if (isQrNfcPlatformRole(role)) return true;
  return user.agencyId === agencyId;
}

export function canViewQrNfcCodes(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  const role = effectiveRole(user);
  if (!VIEW_ROLES.has(role)) return false;
  if (isQrNfcPlatformRole(role) || isRcInternalOperator(role)) return true;
  return user.agencyId === agencyId;
}

export function canManageQrNfcCodes(user: UserContext, agencyId: string): boolean {
  return canCreateQrNfcCodes(user, agencyId);
}

/** Alias — deactivate uses the same role set as create. */
export const canDeactivateQrNfcCodes = canManageQrNfcCodes;

/** View roles may download PNG assets. */
export const canDownloadQrNfcCodes = canViewQrNfcCodes;

export function resolveQrNfcAgencyId(
  user: UserContext,
  requestedAgencyId: string | undefined,
): string {
  const role = effectiveRole(user);
  if (isQrNfcPlatformRole(role)) {
    return (requestedAgencyId ?? user.agencyId).trim();
  }
  return user.agencyId;
}
