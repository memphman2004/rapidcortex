import {
  dashboardRouteFromRole,
  migrateLegacyRapidCortexRoleTokenValue,
} from "rapid-cortex-shared";

/** Cognito test users may use compact tokens (campusadmin) or hyphenated (venue-admin). */
export function normalizeVerticalRoleToken(role: string): string {
  const raw = role.trim();
  return migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw.toLowerCase();
}

/** Resolve the canonical dashboard route for a role + agency. */
export function resolveRoleRoute(role: string, agencyId = ""): string {
  const normalized = normalizeVerticalRoleToken(role);
  const route = dashboardRouteFromRole(normalized, agencyId);
  return route !== "/not-authorized" ? route : "/dashboard";
}

/**
 * Build the workspace URL for a vertical product shell.
 * Never returns a bare `/app/{vertical}` path — always a concrete role dashboard.
 */
const VERTICAL_DASHBOARD_FALLBACK: Record<string, string> = {
  campus: "/app/campus/admin",
  venue: "/app/venue/admin",
  hospital: "/hospital-admin/dashboard",
  transit: "/app/transit/admin",
};

export function buildWorkspaceUrl(vertical: string, role: string, agencyId = ""): string {
  const normalized = normalizeVerticalRoleToken(role);
  const route = dashboardRouteFromRole(normalized, agencyId);
  if (route.startsWith("/app/")) return route;
  if (route !== "/not-authorized") return route;
  return VERTICAL_DASHBOARD_FALLBACK[vertical] ?? `/app/${vertical}`;
}
