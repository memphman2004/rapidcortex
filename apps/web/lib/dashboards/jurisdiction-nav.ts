import type { DashboardPrefix } from "./dashboard-access";
import type { NavTab } from "./role-dashboard-config";

/** Role shells whose nav targets live under `/{jurisdictionSlug}/…` (except absolute paths). */
export const JURISDICTION_SCOPED_DASHBOARD_PREFIXES: readonly DashboardPrefix[] = [
  "dispatcher",
  "supervisor",
  "qa",
  "agency-admin",
  "it-security",
  "executive",
];

export function isJurisdictionScopedDashboardPrefix(prefix: DashboardPrefix): boolean {
  return (JURISDICTION_SCOPED_DASHBOARD_PREFIXES as readonly string[]).includes(prefix);
}

/** Paths that must not receive a jurisdiction prefix (dedicated role-shell routes). */
export function isAbsoluteRoleShellPath(href: string): boolean {
  return (
    href.startsWith("/rc-admin") ||
    href.startsWith("/agency-admin") ||
    href.startsWith("/hospital-admin") ||
    href.startsWith("/hospital-staff") ||
    href === "/dispatcher/dashboard"
  );
}

export function resolveRoleNavHref(
  prefix: DashboardPrefix,
  tab: NavTab,
  jurisdictionSlug: string,
): string {
  if (tab.href) {
    const path = tab.href.startsWith("/") ? tab.href : `/${tab.href}`;
    if (isJurisdictionScopedDashboardPrefix(prefix) && !isAbsoluteRoleShellPath(path)) {
      return `/${jurisdictionSlug}${path}`;
    }
    return path;
  }
  return `/${prefix}/dashboard#${tab.id}`;
}
