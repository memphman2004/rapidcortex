import {
  isRcsuperadmin,
  migrateLegacyRapidCortexRoleTokenValue,
  type UserContext,
} from "rapid-cortex-shared";

function normalizedRole(user: Pick<UserContext, "role">): string {
  const raw = String(user.role ?? "").trim();
  return migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw;
}

function sameAgency(user: Pick<UserContext, "agencyId">, agencyId: string): boolean {
  return Boolean(agencyId) && user.agencyId === agencyId;
}

/** Keep aligned with `apps/web/lib/analytics/analytics-authz.ts`. */
const ALLOWED_ROLES = new Set([
  "agencyadmin",
  "supervisor",
  "agencyit",
  "campus_admin",
  "campus_admin_k12",
  "campus_admin_highered",
  "campus_supervisor",
  "campus_supervisor_k12",
  "campus_supervisor_highered",
  "venue_admin",
  "venue_supervisor",
  "transit_admin",
  "transit_supervisor",
  "hospital_admin",
  "hospitaladmin",
  "hospital_supervisor",
  "rcsuperadmin",
  "rcadmin",
]);

const DENIED_ROLES = new Set([
  "dispatcher",
  "call_taker",
  "campus_security",
  "campus_security_k12",
  "campus_security_highered",
  "campus_dispatch",
  "campus_dispatch_k12",
  "campus_dispatch_highered",
  "campus_counselor",
  "campus_counselor_k12",
  "campus_counselor_highered",
  "campus_faculty",
  "campus_faculty_k12",
  "campus_faculty_highered",
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
  // RC platform operators may view cross-agency / platform iQ reporting.
  if (role === "rcsuperadmin" || role === "rcadmin" || isRcsuperadmin(user)) return true;
  if (!sameAgency(user, agencyId)) return false;
  return ALLOWED_ROLES.has(role);
}
