import { isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";
import { AuthorizationService } from "./authorization-service.js";

const authz = new AuthorizationService();

/** Tenant-scoped QR location list / asset download. */
export function canViewQrLocations(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (user.agencyId !== agencyId) return false;
  return (
    authz.canPerform(user, "locations.qrcodes.manage") ||
    authz.canPerform(user, "locations.qrcodes.view")
  );
}

/** Tenant-scoped QR location create / update / deactivate / bulk import. */
export function canManageQrLocations(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (user.agencyId !== agencyId) return false;
  return authz.canPerform(user, "locations.qrcodes.manage");
}
