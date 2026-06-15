import type { UserContext } from "rapid-cortex-shared/types";
import { isRcInternalOperator, isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import {
  resolvePostAuthenticationHomeHref,
  resolvePostAuthenticationHomeHrefAfterPasswordChange,
  resolvePostLoginNavigationHrefAfterPasswordChange,
} from "@/lib/auth/post-login-redirect";

/** Canonical redirect target for the `/dashboard` role hub (RSC). */
export function resolveDashboardHubRedirectHref(
  user: UserContext,
  options?: {
    passwordRotationBypass?: boolean;
    jurisdictionSlug?: string;
    fromParam?: string | null;
  },
): string {
  const slug = options?.jurisdictionSlug ?? defaultJurisdictionSlug();
  if (options?.passwordRotationBypass) {
    const from = options.fromParam?.trim();
    if (from?.startsWith("/")) {
      return resolvePostLoginNavigationHrefAfterPasswordChange(user, from, slug);
    }
    return resolvePostAuthenticationHomeHrefAfterPasswordChange(user, slug);
  }
  return resolvePostAuthenticationHomeHref(user, slug);
}

/** Platform operators should never enter the `(app)/dashboard` dispatcher hub. */
export function shouldRedirectAwayFromDashboardHub(user: UserContext): boolean {
  return isRcsuperadmin(user) || isRcInternalOperator(user.role);
}

export function dashboardHubRedirectForInternalOperator(user: UserContext): string {
  return resolvePostAuthenticationHomeHrefAfterPasswordChange(user, defaultJurisdictionSlug());
}
