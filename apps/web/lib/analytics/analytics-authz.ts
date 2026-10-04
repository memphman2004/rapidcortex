/**
 * iQ Reporting — client/BFF RBAC.
 *
 * Mirrors `apps/web/lib/rcs/rcs-authz.ts` (`normalizedRole`, `sameAgency`,
 * `isRcsuperadmin`). Front-line operator roles are an explicit deny — never inferred.
 */

import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";

function normalizedRole(user: Pick<UserContext, "role">): string {
  const raw = String(user.role ?? "").trim();
  return migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw;
}

function sameAgency(user: Pick<UserContext, "agencyId">, agencyId: string): boolean {
  return Boolean(agencyId) && user.agencyId === agencyId;
}

/** Supervisor / admin operators who may see iQ reporting. */
const ALLOWED_ROLES = new Set([
  "agencyadmin",
  "supervisor",
  "agencyit",
  "campus_admin",
  "campus_supervisor",
  "venue_admin",
  "venue_supervisor",
  "transit_admin",
  "transit_supervisor",
  "hospital_admin",
  "hospitaladmin",
  "hospital_supervisor",
  "rcsuperadmin",
]);

/**
 * Front-line / operator roles — never show iQ reporting, even if agency matches.
 * `hospital_coord` is denied; `hospital_supervisor` is allowed.
 */
const DENIED_ROLES = new Set([
  "dispatcher",
  "call_taker",
  "campus_security",
  "campus_counselor",
  "campus_faculty",
  "venue_security",
  "venue_operator",
  "venue_guest",
  "transit_security",
  "transit_operator",
  "hospital_staff",
  "hospitalstaff",
  "hospital_coord",
  "call_assist_operator",
]);

export function canViewIQReporting(user: UserContext, agencyId: string): boolean {
  const role = normalizedRole(user);
  if (DENIED_ROLES.has(role)) return false;
  if (isRcsuperadmin(user) && role === "rcsuperadmin") return true;
  if (!sameAgency(user, agencyId)) return false;
  return ALLOWED_ROLES.has(role);
}
