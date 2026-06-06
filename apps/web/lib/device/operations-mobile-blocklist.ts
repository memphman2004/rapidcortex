/**
 * Path classification for mobile operational blocking (middleware + API guard).
 */
import { RESERVED_PUBLIC_ROUTE_FIRST_SEGMENTS } from "@/lib/reserved-public-route-segments";

const RESERVED_PUBLIC_SLUG_SET = new Set(
  RESERVED_PUBLIC_ROUTE_FIRST_SEGMENTS.map((s) => s.toLowerCase()),
);

export function isMobilePublicApiPath(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  const checks: ((p: string) => boolean)[] = [
    (p) => p === "/api/health" || p.startsWith("/api/health/"),
    (p) => p === "/api/csp-report" || p.startsWith("/api/csp-report/"),
    (p) => p === "/api/contact-sales" || p.startsWith("/api/contact-sales/"),
    (p) => p.startsWith("/api/public/"),
    (p) => p === "/api/status" || p.startsWith("/api/status/"),
    (p) => p === "/api/readiness" || p.startsWith("/api/readiness/"),
    (p) => p === "/api/features" || p.startsWith("/api/features/"),
  ];
  return checks.some((f) => f(pathname));
}

const ROOT_OPERATIONAL_PREFIXES: readonly string[] = [
  "/login",
  "/signin",
  "/auth",
  "/signup",
  "/logout",
  "/dispatcher",
  "/supervisor",
  "/rc-admin",
  "/staff",
  "/agency-admin",
  "/executive",
  "/responder",
  "/it-security",
  "/qa",
  "/review",
  "/shared-incoming",
  "/billing/checkout",
  "/billing/success",
  "/billing/cancel",
  "/rc-lite/portal",
  "/docs",
  "/media/live",
];

/** Jurisdiction first segment is not reserved → second segment matches these → block. */
const JURISDICTION_OPERATIONAL_SUBPATH_PREFIXES: readonly string[] = [
  "/login",
  "/admin",
  "/dashboard",
  "/dispatcher",
  "/supervisor",
  "/staff",
  "/rc-admin",
  "/review",
  "/shared-incoming",
  "/demo",
  "/history",
  "/support",
  "/command",
  "/reliability",
  "/media",
  "/no-access",
  "/incidents",
  "/calls",
  "/settings",
];

function hasOperationalRootPrefix(pathname: string): boolean {
  for (const p of ROOT_OPERATIONAL_PREFIXES) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }

  // Careful: `/administration` hypothetical — block only `/admin` as segment boundary
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname === "/console" || pathname.startsWith("/console/")) return true;
  if (pathname === "/agency" || pathname.startsWith("/agency/")) return true;
  if (pathname === "/incidents" || pathname.startsWith("/incidents/")) return true;
  if (pathname === "/calls" || pathname.startsWith("/calls/")) return true;
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return true;

  return false;
}

/** HTML navigations / RSC loads that must redirect on mobile when blocking is active. */
export function pathnameIsMobileOperationalBlockedPage(pathname: string): boolean {
  if (pathname === "/mobile-access-restricted" || pathname.startsWith("/mobile-access-restricted/")) {
    return false;
  }

  if (hasOperationalRootPrefix(pathname)) return true;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  const first = segments[0]!.toLowerCase();
  if (first === "api") return false;

  const rest =
    segments.length >= 2 ? `/${segments.slice(1).join("/")}` : "/";

  if (!RESERVED_PUBLIC_SLUG_SET.has(first)) {
    return JURISDICTION_OPERATIONAL_SUBPATH_PREFIXES.some(
      (p) => rest === p || rest.startsWith(`${p}/`),
    );
  }

  // Reserved slug paths: only block authenticated enclaves under marketing-style roots
  if (first === "rc-lite" && rest.startsWith("/portal")) return true;
  if (first === "media" && rest.startsWith("/live")) return true;

  return false;
}

/** API requests (besides allowlist) return 403 JSON on mobile when blocking is active. */
export function pathnameIsMobileOperationalBlockedApi(pathname: string): boolean {
  if (!pathname.startsWith("/api") && !pathname.startsWith("/api/")) return false;
  if (isMobilePublicApiPath(pathname)) return false;
  return true;
}
