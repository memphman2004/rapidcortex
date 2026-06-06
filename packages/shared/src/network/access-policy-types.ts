export interface TimeWindow {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export interface DailySchedule {
  enabled: boolean;
  windows: TimeWindow[];
}

export interface ShiftSchedule {
  timezone: string;
  schedule: Record<DayOfWeek, DailySchedule>;
}

export interface CidrEntry {
  cidr: string;
  label: string;
  addedAt: string;
  addedBy: string;
}

export interface AgencyNetworkPolicy {
  ipAllowlistEnabled: boolean;
  allowedCidrs: CidrEntry[];
  wafIpSetId?: string;
  wafIpSetArn?: string;
  wafSyncedAt?: string;
  wafSyncStatus?: "synced" | "syncing" | "error" | "not_configured";

  timeRestrictionEnabled: boolean;
  shiftSchedule?: ShiftSchedule;
  allowEmergencyOverride: boolean;

  lastUpdatedAt: string;
  lastUpdatedBy: string;
  bypassRoles: string[];
  schemaVersion: number;
}

export interface AccessCheckResult {
  allowed: boolean;
  blockedBy?: "ip_allowlist" | "time_restriction";
  message?: string;
  retryAfter?: string;
  /** Log-safe masked IP when blocked by IP allowlist (preflight JSON only; omit from strict 403 bodies). */
  maskedClientIp?: string;
  /** Agency IANA timezone for formatting `retryAfter` on the client (preflight only). */
  shiftTimezone?: string;
  /** Whether supervisors may grant emergency tokens (time blocks only). */
  allowEmergencyOverride?: boolean;
}

export interface EmergencyOverrideToken {
  tokenId: string;
  agencyId: string;
  userId: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string;
  reason: string;
  used: boolean;
}

export interface EmergencyOverrideRequest {
  requestId: string;
  agencyId: string;
  userId: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export type NetworkPolicyAuditAction =
  | "policy_updated"
  | "cidr_added"
  | "cidr_removed"
  | "time_restriction_enabled"
  | "time_restriction_disabled"
  | "schedule_updated"
  | "emergency_override_granted"
  | "emergency_override_used"
  | "emergency_override_requested"
  | "access_denied_ip"
  | "access_denied_time";

export const NETWORK_BYPASS_ROLES = ["rcsuperadmin", "rcadmin", "rcitadmin"] as const;

export function defaultAgencyNetworkPolicy(actorEmail = "system"): AgencyNetworkPolicy {
  const now = new Date().toISOString();
  const emptyDay: DailySchedule = { enabled: false, windows: [] };
  return {
    ipAllowlistEnabled: false,
    allowedCidrs: [],
    timeRestrictionEnabled: false,
    shiftSchedule: {
      timezone: "America/New_York",
      schedule: {
        monday: emptyDay,
        tuesday: emptyDay,
        wednesday: emptyDay,
        thursday: emptyDay,
        friday: emptyDay,
        saturday: emptyDay,
        sunday: emptyDay,
      },
    },
    allowEmergencyOverride: false,
    lastUpdatedAt: now,
    lastUpdatedBy: actorEmail,
    bypassRoles: [...NETWORK_BYPASS_ROLES],
    schemaVersion: 1,
    wafSyncStatus: "not_configured",
  };
}
