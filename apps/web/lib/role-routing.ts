import {
  dashboardRouteFromRole,
  migrateLegacyRapidCortexRoleTokenValue,
} from "rapid-cortex-shared";

/** Cognito test users may use compact tokens (campusadmin) or hyphenated (venue-admin). */
const COMPACT_VERTICAL_ROLE: Record<string, string> = {
  campusadmin: "campus_admin",
  campussecurity: "campus_security",
  campussupervisor: "campus_supervisor",
  campusfaculty: "campus_faculty",
  campuscounselor: "campus_counselor",
  "venue-admin": "venue_admin",
  "venue-security": "venue_security",
  "venue-supervisor": "venue_supervisor",
  "hospital-admin": "hospital_admin",
  "hospital-staff": "hospital_staff",
  "transit-admin": "transit_admin",
  "transit-security": "transit_security",
};

export function normalizeVerticalRoleToken(role: string): string {
  const raw = role.trim();
  const lower = raw.toLowerCase();
  if (COMPACT_VERTICAL_ROLE[lower]) return COMPACT_VERTICAL_ROLE[lower];
  if (COMPACT_VERTICAL_ROLE[raw]) return COMPACT_VERTICAL_ROLE[raw];
  return migrateLegacyRapidCortexRoleTokenValue(raw) ?? lower;
}

/** Resolve the canonical dashboard route for a role + agency. */
export function resolveRoleRoute(role: string, agencyId = ""): string {
  const normalized = normalizeVerticalRoleToken(role);
  const route = dashboardRouteFromRole(normalized, agencyId);
  return route !== "/not-authorized" ? route : "/dashboard";
}

/**
 * Build `/app/{vertical}/{roleSlug}` using shared vertical routing.
 * Falls back to `/app/{vertical}` when the role is unknown.
 */
export function buildWorkspaceUrl(vertical: string, role: string, agencyId = ""): string {
  const route = resolveRoleRoute(role, agencyId);
  if (route.startsWith("/app/")) return route;
  return `/app/${vertical}`;
}
