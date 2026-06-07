import type { UserContext } from "rapid-cortex-shared/types";
import { requiresOperationalPasswordRenewal } from "rapid-cortex-shared/auth/password-policy";
import { resolveHospitalPortalDashboardHref } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { hasRapidCortexDashboardAccess, hasRcLitePortalAccess } from "rapid-cortex-shared/auth/session-product";
import { isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import {
  dashboardPrefixFromPathname,
  defaultDashboardHrefForRole,
  userMayAccessDashboardPrefix,
} from "@/lib/dashboards/dashboard-access";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";

type CommercialUser = UserContext & {
  isSubscriber?: boolean;
  subscriptionStatus?: string;
  planId?: string;
};

function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim();
}

export function extractVenueCode(agencyId: string): string {
  const raw = agencyId.trim();
  const match = raw.match(/(?:test-)?venue-(.+)$/i);
  return (match?.[1] ?? raw).toUpperCase().replace(/-/g, "");
}

export function extractCampusCode(agencyId: string): string {
  const raw = agencyId.trim();
  const match = raw.match(/(?:test-)?campus-(.+)$/i);
  return (match?.[1] ?? raw).toUpperCase().replace(/-/g, "");
}

export function resolveProductDashboardFromRoleAndAgency(
  role: string | null | undefined,
  agencyId: string | null | undefined,
): string {
  const roleToken = normalizeRole(role);
  const roleUpper = roleToken.toUpperCase();
  const agency = (agencyId ?? "").trim();

  if (roleUpper.startsWith("VENUE_")) {
    return `/app/venue/${extractVenueCode(agency)}`;
  }
  if (roleUpper.startsWith("CAMPUS_")) {
    return `/app/campus/${extractCampusCode(agency)}`;
  }
  const hospitalHome = resolveHospitalPortalDashboardHref(roleToken);
  if (hospitalHome) return hospitalHome;
  if (roleUpper.startsWith("TRANSIT_")) {
    return "/app/transit";
  }
  if (roleToken === "rcsuperadmin" || roleToken === "rcadmin") {
    return "/rc-admin/dashboard";
  }
  if (roleToken === "rcitadmin") {
    return "/rc-admin/infrastructure";
  }

  return "";
}

/**
 * Canonical post-login destination when no explicit `from` redirect is trusted.
 */
/**
 * Home URL after a **successful in-app password change** (Cognito `ChangePassword` already succeeded).
 * Skips the operational renewal gate: ID tokens can still carry a stale `custom:pwdChangedAt` for one refresh
 * until upstream sync / claim propagation, which would otherwise send the user back to `/change-password`.
 */
export function resolvePostAuthenticationHomeHrefAfterPasswordChange(
  user: UserContext,
  jurisdictionSlug = defaultJurisdictionSlug(),
): string {
  const u = user as CommercialUser;
  const productHome = resolveProductDashboardFromRoleAndAgency(user.role, user.agencyId);
  if (productHome) return productHome;
  if (isRcsuperadmin(user)) return "/rc-admin/dashboard";
  if (hasRapidCortexDashboardAccess(u)) return defaultDashboardHrefForRole(user.role, jurisdictionSlug);
  if (hasRcLitePortalAccess(u)) return "/rc-lite/portal";
  return `/${jurisdictionSlug}/no-access`;
}

export function resolvePostAuthenticationHomeHref(
  user: UserContext,
  jurisdictionSlug = defaultJurisdictionSlug(),
): string {
  if (requiresOperationalPasswordRenewal(user)) {
    return "/change-password";
  }
  return resolvePostAuthenticationHomeHrefAfterPasswordChange(user, jurisdictionSlug);
}

/**
 * Applies the `from` query safely: legacy `/{slug}/dashboard` hub is replaced with the role home;
 * role-dashboard URLs are kept only when the user may access that prefix.
 */
export function resolvePostLoginNavigationHref(
  user: UserContext,
  fromParam: string | null | undefined,
  jurisdictionSlug: string,
): string {
  if (requiresOperationalPasswordRenewal(user)) {
    return "/change-password";
  }
  const canonical = resolvePostAuthenticationHomeHref(user, jurisdictionSlug);
  const raw = typeof fromParam === "string" ? fromParam.trim() : "";
  if (!raw.startsWith("/")) return canonical;

  const pathOnly = raw.split("?")[0]?.split("#")[0] ?? "";

  if (
    pathOnly === `/${jurisdictionSlug}/dashboard` ||
    pathOnly.startsWith(`/${jurisdictionSlug}/dashboard/`)
  ) {
    return canonical;
  }

  const prefix = dashboardPrefixFromPathname(pathOnly);
  if (prefix !== null && !userMayAccessDashboardPrefix(user, prefix)) {
    return canonical;
  }

  return raw;
}
