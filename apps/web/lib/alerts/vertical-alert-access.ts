import { AuthorizationService } from "rapid-cortex-security";
import type { UserRole } from "rapid-cortex-shared";

const authz = new AuthorizationService();

function stubUser(role: string, agencyId: string) {
  return { userId: "ui", agencyId, role: role as UserRole, email: "" };
}

export function verticalAlertAccess(role: string, agencyId = "ui") {
  const user = stubUser(role, agencyId);
  return {
    canDispatch: authz.canPerform(user, "alerts.dispatch"),
    canDispatchCritical: authz.canPerform(user, "alerts.dispatch.critical"),
    canManageRecipients: authz.canPerform(user, "alerts.recipients.manage"),
    canManageTemplates: authz.canPerform(user, "alerts.templates.manage"),
    canViewHistory: authz.canPerform(user, "alerts.history.view"),
  };
}
