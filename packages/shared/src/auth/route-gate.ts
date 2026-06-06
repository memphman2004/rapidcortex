import { hasRapidCortexDashboardAccess, hasRcLitePortalAccess, type SessionProductExtras } from "./session-product.js";
import { isRcInternalOperator } from "../tenancy/principal.js";

/** First URL segment for Rapid Cortex operational web apps (not marketing, not RC Lite console). */
export const OPERATIONAL_DASHBOARD_SEGMENTS = new Set([
  "dispatcher",
  "supervisor",
  "agency-admin",
  "qa",
  "it-security",
  "responder",
  "executive",
]);

export function pathnameTargetsOperationalDashboard(pathname: string): boolean {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg != null && OPERATIONAL_DASHBOARD_SEGMENTS.has(seg);
}

export function pathnameTargetsRcLitePortalArea(pathname: string): boolean {
  return pathname === "/rc-lite/portal" || pathname.startsWith("/rc-lite/portal/");
}

/** Cross-tenant RC Admin console mounted at `/rc-admin`. */
export function pathnameTargetsRcAdminArea(pathname: string): boolean {
  return pathname === "/rc-admin" || pathname.startsWith("/rc-admin/");
}

/**
 * Product / subscription gate only (Cognito `custom:role` and per-route role rules apply in middleware).
 * Used to align tests with Next.js middleware behavior for RC Lite vs Rapid Cortex platform.
 */
export function sessionPassesProductGateForPath(user: SessionProductExtras, pathname: string): boolean {
  if (pathnameTargetsRcAdminArea(pathname)) {
    return isRcInternalOperator(user.role);
  }
  if (pathnameTargetsRcLitePortalArea(pathname)) {
    return hasRcLitePortalAccess(user);
  }
  if (pathnameTargetsOperationalDashboard(pathname)) {
    return hasRapidCortexDashboardAccess(user);
  }
  return true;
}
