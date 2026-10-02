import { isRcsuperadmin } from "rapid-cortex-shared";
import type { UserContext, UserRole } from "rapid-cortex-shared";
import type { AccessOverrideType } from "../types/accessOverride.js";

/** Dashboard URL segments (excluding elevated admin routes). */
const AGENCY_ADMIN_DASHBOARD_PREFIXES = [
  "dispatcher",
  "qa",
  "supervisor",
  "it-security",
  "responder",
  "executive",
] as const;

const PLATFORM_ONLY_DASHBOARD_PREFIXES = ["agency-admin", "rc-admin"];

const ADMIN_GRANTABLE_ROLES = new Set<UserRole>([
  "dispatcher",
  "supervisor",
  "agencyit",
  "analyst",
  "auditor",
]);

const FEATURE_ALLOWLIST = new Set([
  "feature:video_assist",
  "feature:silent_text",
  "feature:desktop_releases",
]);

const INCIDENT_ACCESS_ALLOWLIST = new Set(["incident-access:assigned_only", "incident-access:read"]);

export function assertGrantWithinAuthority(
  actor: UserContext,
  overrideType: AccessOverrideType,
  grantedRoleOrPermission: string,
): void {
  const g = grantedRoleOrPermission.trim();
  if (!g) throw new Error("INVALID_GRANT");

  if (overrideType === "role") {
    const role = g as UserRole;
    if (role === "rcsuperadmin") throw new Error("INVALID_GRANT");
    if (!isRcsuperadmin(actor)) {
      if (role === "agencyadmin") throw new Error("INVALID_GRANT");
      if (!ADMIN_GRANTABLE_ROLES.has(role)) throw new Error("INVALID_GRANT");
    }
    return;
  }

  if (overrideType === "permission" && g.toLowerCase().startsWith("dashboard:")) {
    const prefix = g.slice("dashboard:".length).trim();
    if (!prefix) throw new Error("INVALID_GRANT");
    const elevated = PLATFORM_ONLY_DASHBOARD_PREFIXES.includes(prefix as "agency-admin");
    if (elevated && !isRcsuperadmin(actor)) throw new Error("INVALID_GRANT");
    const allowedPrefixes = [...AGENCY_ADMIN_DASHBOARD_PREFIXES, ...(isRcsuperadmin(actor) ? PLATFORM_ONLY_DASHBOARD_PREFIXES : [])];
    if (!allowedPrefixes.includes(prefix as (typeof allowedPrefixes)[number])) {
      throw new Error("INVALID_GRANT");
    }
    return;
  }

  if (overrideType === "feature") {
    if (!FEATURE_ALLOWLIST.has(g)) throw new Error("INVALID_GRANT");
    return;
  }

  if (overrideType === "incident-access") {
    if (!INCIDENT_ACCESS_ALLOWLIST.has(g)) throw new Error("INVALID_GRANT");
    return;
  }

  if (overrideType === "permission") {
    /** Non-dashboard permission bundles must be enumerated. */
    throw new Error("INVALID_GRANT");
  }

  throw new Error("INVALID_GRANT");
}

export function parseDashboardPrefixesFromGrant(granted: string): string[] | null {
  const g = granted.trim();
  if (!g.toLowerCase().startsWith("dashboard:")) return null;
  return [g.slice("dashboard:".length).trim()].filter(Boolean);
}

/** Returns one segment such as `qa` when grant is `dashboard:qa`. */
export function extractDashboardPrefix(granted: string): string | null {
  return parseDashboardPrefixesFromGrant(granted)?.[0] ?? null;
}
