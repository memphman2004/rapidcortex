import { isRcsuperadmin, isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";
import { AuthorizationService } from "./authorization-service.js";

const authz = new AuthorizationService();

function rcInternalMayManageQr(user: UserContext): boolean {
  return isRcInternalOperator(user.role) && authz.canPerform(user, "locations.qrcodes.manage");
}

/** Tenant-scoped QR location list / asset download. */
export function canViewQrLocations(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (rcInternalMayManageQr(user)) return true;
  if (user.agencyId !== agencyId) return false;
  return (
    authz.canPerform(user, "locations.qrcodes.manage") ||
    authz.canPerform(user, "locations.qrcodes.view")
  );
}

/** Tenant-scoped QR location create / update / deactivate / bulk import. */
export function canManageQrLocations(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (rcInternalMayManageQr(user)) return true;
  if (user.agencyId !== agencyId) return false;
  return authz.canPerform(user, "locations.qrcodes.manage");
}
