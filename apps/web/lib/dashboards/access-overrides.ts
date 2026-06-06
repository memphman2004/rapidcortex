import type { UserContext } from "rapid-cortex-shared/types";
import type { DashboardPrefix } from "./dashboard-access";

const DASHBOARD_PREFIXES: DashboardPrefix[] = [
  "rc-admin",
  "agency-admin",
  "dispatcher",
  "supervisor",
  "qa",
  "it-security",
  "executive",
];

function isDashboardPrefix(value: string): value is DashboardPrefix {
  return (DASHBOARD_PREFIXES as readonly string[]).includes(value);
}

/**
 * Optional per-user access extensions.
 * TODO: Replace with persisted agency-managed overrides (DynamoDB) + audit logs.
 */
export function getAdditionalDashboardPrefixes(user: UserContext): DashboardPrefix[] {
  const raw = (user as UserContext & { dashboardAccess?: unknown }).dashboardAccess;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((v): v is DashboardPrefix => typeof v === "string" && isDashboardPrefix(v));
  }
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is DashboardPrefix => isDashboardPrefix(v));
}
