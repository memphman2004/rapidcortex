import type { UserContext } from "rapid-cortex-shared/types";
import { requiresOperationalPasswordRenewal } from "rapid-cortex-shared/auth/password-policy";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import {
  dashboardRouteFromRole,
  verticalFromRole,
} from "rapid-cortex-shared";
import { hasRapidCortexDashboardAccess, hasRcLitePortalAccess } from "rapid-cortex-shared/auth/session-product";
import { isRcInternalOperator, isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
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
  const agency = (agencyId ?? "").trim();
  const vertical = verticalFromRole(roleToken);

  if (vertical === "platform") return "";

  const route = dashboardRouteFromRole(roleToken, agency);
  if (route !== "/not-authorized") return route;

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
  const effective =
    migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
  if (effective === "rcitadmin") return "/rc-admin/infrastructure";
  if (effective === "rcsuperadmin" || isRcsuperadmin(user)) return "/rc-admin/dashboard";
  if (effective === "rcadmin" || isRcInternalOperator(user.role)) {
    return "/rc-admin/dashboard";
  }
  const productHome = resolveProductDashboardFromRoleAndAgency(user.role, user.agencyId);
  if (productHome) return productHome;
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
function resolveTrustedPostLoginFromParam(
  user: UserContext,
  fromParam: string | null | undefined,
  jurisdictionSlug: string,
  canonical: string,
): string {
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

export function resolvePostLoginNavigationHref(
  user: UserContext,
  fromParam: string | null | undefined,
  jurisdictionSlug: string,
): string {
  if (requiresOperationalPasswordRenewal(user)) {
    return "/change-password";
  }
  return resolveTrustedPostLoginFromParam(
    user,
    fromParam,
    jurisdictionSlug,
    resolvePostAuthenticationHomeHref(user, jurisdictionSlug),
  );
}

/**
 * Post-login navigation immediately after a successful password rotation (NEW_PASSWORD_REQUIRED
 * challenge or in-app change). Skips the operational renewal gate because JWT `custom:pwdChangedAt`
 * / `custom:pwdChangeReq` may lag until upstream sync and token rotation propagate.
 */
export function resolvePostLoginNavigationHrefAfterPasswordChange(
  user: UserContext,
  fromParam: string | null | undefined,
  jurisdictionSlug: string,
): string {
  return resolveTrustedPostLoginFromParam(
    user,
    fromParam,
    jurisdictionSlug,
    resolvePostAuthenticationHomeHrefAfterPasswordChange(user, jurisdictionSlug),
  );
}
