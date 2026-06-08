import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserContext } from "rapid-cortex-shared/types";
import type { DashboardPrefix } from "./dashboard-access";
import { filterRcAdminNavTabs } from "./rc-admin-role-nav";
import { resolvePsapRole } from "./psap-role-nav";
import { ROLE_DASHBOARD_NAV, type NavTab } from "./role-dashboard-config";

/** Sidebar tabs scoped to the signed-in role — no cross-role tool links. */
export function getRoleDashboardNavTabs(prefix: DashboardPrefix, user: UserContext): NavTab[] {
  const base = ROLE_DASHBOARD_NAV[prefix];

  if (prefix === "rc-admin") {
    return filterRcAdminNavTabs(base, user.role);
  }

  if (prefix === "agency-admin") {
    if (resolvePsapRole(user.role) === "agencyit") return [];
    return base;
  }

  if (prefix === "it-security") {
    return base;
  }

  if (prefix === "dispatcher") {
    return base.filter(
      (tab) =>
        ![
          "supervisor-assist",
          "ai-summary",
          "caller-information",
          "safety-alerts",
          "recent-calls",
          "shift-notes",
          "translation",
          "cad-entry",
        ].includes(tab.id),
    );
  }

  if (prefix === "qa" || prefix === "supervisor" || prefix === "executive") {
    return base;
  }

  if (prefix === "hospital-staff") {
    return base.filter((tab) => tab.id !== "analytics" && tab.id !== "users");
  }

  return base;
}
