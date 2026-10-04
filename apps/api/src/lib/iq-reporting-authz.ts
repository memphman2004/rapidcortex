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
