import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserContext, UserRole } from "rapid-cortex-shared/types";
import {
  isRcInternalOperator,
  isRcsuperadmin,
} from "rapid-cortex-shared/tenancy/principal";

/**
 * Canonical post-login home per role under a jurisdiction slug.
 * Legacy tokens normalize to canonical roles.
 */
export function jurisdictionRoleHomeHref(
  role: UserRole | string,
  jurisdictionSlug: string,
): string {
  const effective = (migrateLegacyRapidCortexRoleTokenValue(
    typeof role === "string" ? role : role,
  ) ?? role) as string;

  if (effective === "rcsuperadmin") {
    return "/rc-admin/dashboard";
  }
  if (effective === "rcitadmin") {
    return "/rc-admin/infrastructure";
  }
  if (isRcInternalOperator(effective)) {
    return "/rc-admin/dashboard";
  }

  switch (effective) {
    case "dispatcher":
      return `/${jurisdictionSlug}/dashboard`;
    case "supervisor":
      return `/${jurisdictionSlug}/supervisor`;
    case "agencyadmin":
      return `/${jurisdictionSlug}/admin`;
    case "agencyit":
      return `/${jurisdictionSlug}/admin/it`;
    case "analyst":
      return `/${jurisdictionSlug}/analytics`;
    case "auditor":
      return `/${jurisdictionSlug}/audit`;
    case "hospitaladmin":
      return "/hospital-admin/dashboard";
    case "hospitalstaff":
      return "/hospital-staff/dashboard";
    default:
      return `/${jurisdictionSlug}/dashboard`;
  }
}

export function jurisdictionRoleHomeHrefForUser(
  user: Pick<UserContext, "role" | "agencyId">,
  jurisdictionSlug: string,
): string {
  if (isRcsuperadmin(user as UserContext)) return "/rc-admin/dashboard";
  const effective = migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
  if (effective === "rcitadmin") return "/rc-admin/infrastructure";
  if (effective === "rcadmin") return "/rc-admin/dashboard";
  return jurisdictionRoleHomeHref(user.role, jurisdictionSlug);
}
