"use client";

/**
 * Detects PSAP non-dispatcher console home paths where PsapConsoleHome owns chrome.
 * Sub-routes keep DispatchShell TopBar + SideNav.
 */
export function isPsapConsoleHomePath(pathname: string): boolean {
  const path = (pathname.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  // /{jurisdiction}/supervisor | /admin | /admin/it | /analytics | /audit
  return /^\/[^/]+\/(supervisor|admin|admin\/it|analytics|audit)$/i.test(path);
}
