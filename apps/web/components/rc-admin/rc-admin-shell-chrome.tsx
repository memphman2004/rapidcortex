/**
 * Detects RC Admin console home paths where RcAdminConsoleHome owns chrome.
 * Sub-routes keep DashboardShell RoleNavSidebar / TopNav / header strip.
 *
 * - `/rc-admin/dashboard` — home for rcsuperadmin / rcadmin
 * - `/rc-admin/infrastructure` — home for rcitadmin only (other roles keep shell)
 */
export function isRcAdminConsoleHomePath(
  pathname: string,
  role?: string | null,
): boolean {
  const path = (pathname.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  if (path === "/rc-admin/dashboard") return true;
  if (path === "/rc-admin/infrastructure") {
    return (role ?? "").trim().toLowerCase() === "rcitadmin";
  }
  return false;
}
