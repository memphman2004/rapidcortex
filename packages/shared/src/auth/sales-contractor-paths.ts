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
  "/rc-admin/intelligence/watch",
  "/rc-admin/watch-ingest",
  "/rc-admin/sales-automation",
  "/rc-admin/email-list",
  "/rc-admin/marketing",
  "/rc-admin/nexiq/intel/sources",
  "/rc-admin/nexiq/intel/coverage",
  "/rc-admin/conferences",
  "/rc-admin/support",
  "/rc-admin/grants",
  "/rc-admin/onboarding/packets",
  "/rc-admin/system-health",
] as const;

/**
 * API path prefixes that sales contractors may call directly (e.g. from the mobile app).
 * These are checked by any server-side API guard that proxies on behalf of the web app.
 * Note: Next.js middleware already lets all /api/* paths pass through (kind: "system"),
 * so this list is used by explicit API-route guards, not by edge middleware.
 */
export const SALES_CONTRACTOR_API_PATH_PREFIXES = [
  "/api/admin/nfc-cards", // NFC card programming (list, get, update status)
  "/api/business-cards",  // Personal profile routes (/me, /me/photo, /me/publish, /me/qr, /status)
  // NOTE: /api/admin/business-cards is intentionally excluded — listAdmin / updateSettings /
  // archiveProfile all call requireAdmin which rejects salescontractor (not in BUSINESS_CARD_ADMIN_ROLES).
  // The iOS listBusinessCardProfiles() call uses try? so a 403 there is silently swallowed.
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
  // Reference manuals linked from Document Library (middleware also uses canAccessAuthenticatedDocs).
  if (path === "/docs" || path.startsWith("/docs/")) return true;
  return SALES_CONTRACTOR_RC_ADMIN_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** True when a sales contractor may call this API path (used by API-route guards and BFF proxies). */
export function salesContractorMayAccessApiPath(pathname: string): boolean {
  const path = normalizeAppPathname(pathname);
  return SALES_CONTRACTOR_API_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
