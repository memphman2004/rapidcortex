/**
 * Path allowlist for sales contractors — Edge-safe (no tenancy/principal deps).
 * Keep in sync with SALES_CONTRACTOR_NAV and page gates.
 */
export const SALES_CONTRACTOR_RC_ADMIN_PATH_PREFIXES = [
  "/rc-admin/deployments-map",
  "/rc-admin/leads",
  "/rc-admin/signal-feed",
  "/rc-admin/psap-prospects",
  "/rc-admin/contacts",
  "/rc-admin/rapid-iq",
  "/rc-admin/conferences",
  "/rc-admin/support",
  "/rc-admin/grants",
  "/rc-admin/onboarding/packets",
  "/rc-admin/system-health",
] as const;

export function normalizeAppPathname(pathname: string): string {
  const raw = pathname.split("?")[0]?.split("#")[0] ?? "/";
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw || "/";
}

/** True when a sales contractor may navigate to this path. */
export function salesContractorMayAccessPath(pathname: string): boolean {
  const path = normalizeAppPathname(pathname);
  if (path === "/sales" || path.startsWith("/sales/")) return true;
  return SALES_CONTRACTOR_RC_ADMIN_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
