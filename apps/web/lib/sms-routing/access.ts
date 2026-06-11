import type { UserContext } from "rapid-cortex-shared";
import { canManageSmsRouting, canViewSmsRouting } from "rapid-cortex-security";

export function smsRoutingPermissions(user: UserContext, agencyId: string) {
  return {
    canView: canViewSmsRouting(user, agencyId),
    canManage: canManageSmsRouting(user, agencyId),
  };
}
