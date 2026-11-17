/**
 * NEXiQ City Services — Unified Inbox
 *
 * Types, filters, and sort helpers for the multi-channel SR inbox used
 * by supervisors and 311 coordinators. Surfaces requests from voice, SMS,
 * web form, and Open311 inbound in a single ranked view.
 *
 * Account: 158961537080 (nexcortiq-prod). Never reference 621957412915.
 *
 * Gate: `config.unifiedInboxEnabled === true`.
 *       The existing list/query endpoints are UNCHANGED when flag is off.
 *
 * Version: Phase 3 initial implementation.
 */

import type { CallAssistCallRecord } from "./call-record.js";

// ---------------------------------------------------------------------------
// Feature flag gate
// ---------------------------------------------------------------------------

export function isUnifiedInboxEnabled(
  config: { unifiedInboxEnabled?: boolean } | null | undefined,
): boolean {
  return config?.unifiedInboxEnabled === true;
}

// ---------------------------------------------------------------------------
// Channel source enum
// ---------------------------------------------------------------------------

export const SR_CHANNELS = [
  "voice_nova",    // Nova Sonic voice intake
  "voice_lex",     // Lex V2 voice intake
  "sms",           // Inbound SMS / two-way text
  "web_form",      // Resident web portal
  "open311",       // Open311 GeoReport v2 inbound
  "staff_portal",  // Entered by 311 staff
  "mobile_app",    // Future: resident mobile app
] as const;

export type SrChannel = (typeof SR_CHANNELS)[number];

// ---------------------------------------------------------------------------
// Inbox item (extends the base record with display metadata)
// ---------------------------------------------------------------------------

export type InboxItem = {
  confirmationNumber: string;
  agencyId: string;
  status: string;
  /** Maps to `department` field on CallAssistCallRecord. */
  department?: string;
  departmentDisplayName?: string;
  incidentType?: string;
  incidentLocation?: string;
  createdAt?: string;
  updatedAt?: string;
  channel?: SrChannel;
  hasMedia: boolean;
  hasEscalation: boolean;
  needsHumanFollowUp: boolean;
  escalationCount: number;
  /**
   * Priority score (higher = more urgent) used for default inbox sort.
   * Computed by `scoreInboxItem`.
   */
  priorityScore: number;
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type InboxFilter = {
  status?: string[];
  departments?: string[];
  channels?: SrChannel[];
  /** Only items created after this ISO 8601 datetime. */
  createdAfter?: string;
  /** Only items created before this ISO 8601 datetime. */
  createdBefore?: string;
  /** Free-text search against confirmationNumber, incidentLocation. */
  query?: string;
  needsHumanFollowUp?: boolean;
  hasEscalation?: boolean;
};

export type InboxSortField =
  | "createdAt"
  | "updatedAt"
  | "priorityScore"
  | "status"
  | "department";

export type InboxSortOrder = "asc" | "desc";

export type InboxSort = { field: InboxSortField; order: InboxSortOrder };

export const DEFAULT_INBOX_SORT: InboxSort = { field: "priorityScore", order: "desc" };

// ---------------------------------------------------------------------------
// Priority scoring
// ---------------------------------------------------------------------------

/** Status urgency weights for priority scoring. */
const STATUS_WEIGHTS: Record<string, number> = {
  ESCALATED: 10,
  PENDING_REOPEN: 8,
  AWAITING_INFORMATION: 6,
  OPEN: 4,
  IN_PROGRESS: 3,
  ROUTED: 2,
  ACKNOWLEDGED: 1,
  CLOSED: 0,
  CANCELLED: 0,
  DUPLICATE: 0,
};

/** Channel urgency weights. */
const CHANNEL_WEIGHTS: Record<SrChannel, number> = {
  voice_nova: 3,
  voice_lex: 3,
  sms: 2,
  web_form: 1,
  open311: 1,
  staff_portal: 2,
  mobile_app: 1,
};

/**
 * Compute a priority score for an inbox item.
 * Higher score = should appear higher in default sort.
 */
export function scoreInboxItem(item: Omit<InboxItem, "priorityScore">): number {
  let score = STATUS_WEIGHTS[item.status] ?? 2;
  if (item.hasEscalation) score += 5;
  if (item.needsHumanFollowUp) score += 4;
  if (item.escalationCount > 1) score += 2;
  score += CHANNEL_WEIGHTS[item.channel ?? "web_form"] ?? 1;

  // Age factor: items older than 4 hours without update get a small bump
  if (item.updatedAt) {
    const ageHours = (Date.now() - new Date(item.updatedAt).getTime()) / 3_600_000;
    if (ageHours > 4 && !["CLOSED", "CANCELLED", "DUPLICATE"].includes(item.status)) {
      score += Math.min(Math.floor(ageHours / 4), 5);
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// Conversion: CallAssistCallRecord → InboxItem
// ---------------------------------------------------------------------------

/**
 * Map a raw call record to an inbox item, adding display metadata.
 * `departmentDisplayName` is populated from the playbook registry when available.
 */
export function toInboxItem(
  record: CallAssistCallRecord,
  opts?: {
    departmentDisplayName?: string;
    channel?: SrChannel;
  },
): InboxItem {
  const r = record as CallAssistCallRecord & {
    statusHistory?: unknown[];
    humanFollowUpRequested?: boolean;
    escalationCount?: number;
    mediaAttachments?: unknown[];
  };

  const hasEscalation = (r.escalationCount ?? 0) > 0 || record.status === "ESCALATED";
  const hasMedia = Array.isArray(r.mediaAttachments) && r.mediaAttachments.length > 0;
  const needsHumanFollowUp = r.humanFollowUpRequested === true;
  const escalationCount = r.escalationCount ?? 0;

  const partial: Omit<InboxItem, "priorityScore"> = {
    confirmationNumber: record.confirmationNumber,
    agencyId: record.agencyId,
    status: record.status,
    department: record.department ?? undefined,
    departmentDisplayName: opts?.departmentDisplayName,
    incidentType: record.incidentType,
    incidentLocation: record.incidentLocation,
    createdAt: record.createdAt ?? undefined,
    updatedAt: record.updatedAt ?? undefined,
    channel: opts?.channel,
    hasMedia,
    hasEscalation,
    needsHumanFollowUp,
    escalationCount,
  };

  return { ...partial, priorityScore: scoreInboxItem(partial) };
}

// ---------------------------------------------------------------------------
// Filter + sort helpers
// ---------------------------------------------------------------------------

/** Apply a filter to an array of inbox items. */
export function filterInboxItems(items: InboxItem[], filter: InboxFilter): InboxItem[] {
  return items.filter((item) => {
    if (filter.status?.length && !filter.status.includes(item.status)) return false;
    if (filter.departments?.length && item.department && !filter.departments.includes(item.department)) return false;
    if (filter.channels?.length && item.channel && !filter.channels.includes(item.channel)) return false;
    if (filter.createdAfter && item.createdAt && item.createdAt < filter.createdAfter) return false;
    if (filter.createdBefore && item.createdAt && item.createdAt > filter.createdBefore) return false;
    if (filter.needsHumanFollowUp === true && !item.needsHumanFollowUp) return false;
    if (filter.hasEscalation === true && !item.hasEscalation) return false;
    if (filter.query) {
      const q = filter.query.toLowerCase();
      const match =
        item.confirmationNumber.toLowerCase().includes(q) ||
        (item.incidentLocation?.toLowerCase().includes(q) ?? false);
      if (!match) return false;
    }
    return true;
  });
}

/** Sort inbox items. Returns a new sorted array; does not mutate input. */
export function sortInboxItems(
  items: InboxItem[],
  sort: InboxSort = DEFAULT_INBOX_SORT,
): InboxItem[] {
  return [...items].sort((a, b) => {
    const av = a[sort.field] ?? "";
    const bv = b[sort.field] ?? "";
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sort.order === "asc" ? cmp : -cmp;
  });
}
