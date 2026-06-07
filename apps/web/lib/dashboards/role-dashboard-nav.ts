import { isRcItAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserContext } from "rapid-cortex-shared/types";
import type { DashboardPrefix } from "./dashboard-access";
import { ROLE_DASHBOARD_NAV, type NavTab } from "./role-dashboard-config";

/** Sidebar tabs scoped to the signed-in role — no cross-role tool links. */
export function getRoleDashboardNavTabs(prefix: DashboardPrefix, user: UserContext): NavTab[] {
  const base = ROLE_DASHBOARD_NAV[prefix];

  if (prefix === "rc-admin") {
    return base.filter((tab) => {
      if (tab.id === "operations") return isRcSuperAdmin(user.role);
      if (tab.id === "infrastructure") {
        const r = migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
        return isRcSuperAdmin(r) || isRcItAdmin(r);
      }
      return true;
    });
  }

  if (prefix === "hospital-staff") {
    return base.filter((tab) => tab.id !== "analytics" && tab.id !== "users");
  }

  return base;
}
