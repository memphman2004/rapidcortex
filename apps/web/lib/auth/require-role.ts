import { redirect } from "next/navigation";
import {
  isPlatformAdmin,
  isRcSuperAdmin,
  normalizeLegacyRole,
} from "rapid-cortex-security";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserContext } from "rapid-cortex-shared/types";
import { resolvePostAuthenticationHomeHref } from "@/lib/auth/post-login-redirect";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { defaultJurisdictionSlug, marketingLoginPath } from "@/lib/marketing-links";

function effectiveRole(role: string): string {
  return migrateLegacyRapidCortexRoleTokenValue(role) ?? role;
}

function roleAllowed(userRole: string, allowed: readonly string[]): boolean {
  const userEffective = effectiveRole(userRole);
  return allowed.some((candidate) => {
    const candidateEffective = effectiveRole(candidate);
    return candidateEffective === userEffective || candidate === userRole;
  });
}

/** Server-only RBAC gate for jurisdiction dashboard pages. */
export async function requireRole(allowed: readonly string[]): Promise<UserContext> {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(marketingLoginPath());
  }
  const role = normalizeLegacyRole(user.role);
  if (isPlatformAdmin(role)) {
    return { ...user, role };
  }
  if (!roleAllowed(user.role, allowed)) {
    redirect(resolvePostAuthenticationHomeHref(user, defaultJurisdictionSlug()));
  }
  return { ...user, role };
}

/** Server-only gate for platform-owner-only surfaces (financial delete, operations hub). */
export async function requireSuperAdmin(): Promise<UserContext> {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(marketingLoginPath());
  }
  const role = normalizeLegacyRole(user.role);
  if (!isRcSuperAdmin(role)) {
    redirect(resolvePostAuthenticationHomeHref(user, defaultJurisdictionSlug()));
  }
  return { ...user, role };
}
