const AUTHOR_ROLES = new Set(["rcsuperadmin", "rcadmin", "salescontractor", "demo"]);

export function isDemoLinkPath(pathname: string): boolean {
  return pathname === "/demo-link" || pathname.startsWith("/demo-link/");
}

export function isNeutralDemoPath(pathname: string): boolean {
  return (
    pathname === "/demo-link/expired" ||
    pathname === "/demo-link/invalid" ||
    pathname === "/demo-link/revoked" ||
    pathname === "/demo-link/ended"
  );
}

export function demoShareTokenFromPath(pathname: string): string | null {
  const match = /^\/demo-link\/s\/([^/]+)\/?$/.exec(pathname);
  const token = match?.[1];
  return token ? decodeURIComponent(token) : null;
}

export function canAuthorDemoSession(role: string | null | undefined): boolean {
  return Boolean(role && AUTHOR_ROLES.has(role));
}

export function demoNeutralPathForReason(reason: "invalid" | "expired" | "revoked" | "unconfigured"): string {
  if (reason === "expired") return "/demo-link/expired";
  if (reason === "revoked") return "/demo-link/revoked";
  return "/demo-link/invalid";
}
