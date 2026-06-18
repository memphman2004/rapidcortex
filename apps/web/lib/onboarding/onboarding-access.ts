import type { UserContext } from "rapid-cortex-shared/types";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import {
  extractCampusCode,
  extractVenueCode,
} from "@/lib/auth/post-login-redirect";

export function normalizeOrgCode(code: string): string {
  return code.trim().toUpperCase().replace(/-/g, "");
}

/** RC operators and agency IT may access onboarding admin surfaces. */
export function canAccessOnboardingAdmin(user: Pick<UserContext, "role">): boolean {
  const role = user.role.trim().toLowerCase();
  if (isRcInternalOperator(user.role)) return true;
  return role === "agencyit";
}

export function canAccessCampusOnboarding(
  user: Pick<UserContext, "role" | "agencyId">,
  orgCode: string,
): boolean {
  if (canAccessOnboardingAdmin(user)) return true;
  if (user.role.trim().toUpperCase() !== "CAMPUS_ADMIN") return false;
  const userCode = extractCampusCode(user.agencyId ?? "");
  return userCode === normalizeOrgCode(orgCode);
}

export function canAccessVenueOnboarding(
  user: Pick<UserContext, "role" | "agencyId">,
  orgCode: string,
): boolean {
  if (canAccessOnboardingAdmin(user)) return true;
  if (user.role.trim().toUpperCase() !== "VENUE_ADMIN") return false;
  const userCode = extractVenueCode(user.agencyId ?? "");
  return userCode === normalizeOrgCode(orgCode);
}

export function resolveCampusOrgCode(
  user: Pick<UserContext, "role" | "agencyId">,
  requested?: string | null,
): string {
  if (requested?.trim()) return normalizeOrgCode(requested);
  if (canAccessOnboardingAdmin(user)) return "";
  return extractCampusCode(user.agencyId ?? "");
}

export function resolveVenueOrgCode(
  user: Pick<UserContext, "role" | "agencyId">,
  requested?: string | null,
): string {
  if (requested?.trim()) return normalizeOrgCode(requested);
  if (canAccessOnboardingAdmin(user)) return "";
  return extractVenueCode(user.agencyId ?? "");
}
