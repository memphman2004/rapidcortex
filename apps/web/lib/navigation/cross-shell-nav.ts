/**
 * Soft App Router navigations between top-level workspace shells corrupt RSC
 * streams (Next.js "Server Reference ID did not match" / blank "couldn't load").
 * Full document navigation is required when the destination shell differs.
 */

export type WorkspaceShell = "rc-admin" | "sales" | "other";

export function workspaceShellFromPath(pathname: string): WorkspaceShell {
  const path = pathname.split("?")[0]?.split("#")[0] || "/";
  if (path === "/rc-admin" || path.startsWith("/rc-admin/")) return "rc-admin";
  if (path === "/sales" || path.startsWith("/sales/")) return "sales";
  return "other";
}

/** True when navigating between the RC Admin and Sales portal shells. */
export function requiresHardCrossShellNav(
  currentPathname: string,
  destinationHref: string,
): boolean {
  const from = workspaceShellFromPath(currentPathname);
  const to = workspaceShellFromPath(destinationHref);
  if (from === "other" || to === "other") return false;
  return from !== to;
}
