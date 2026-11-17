/**
 * NEXiQ City Services — Service Request Analytics
 *
 * Types, aggregation helpers, and computed metrics for the 311 analytics suite.
 * Used by the supervisor dashboard and the RC Admin analytics export.
 *
 * Account: 158961537080 (nexcortiq-prod). Never reference 621957412915.
 *
 * Gate: `config.srAnalyticsEnabled === true`.
 *       Existing analytics suite (call-assist analytics) is UNCHANGED.
 *
 * Version: Phase 3 initial implementation.
 */

import type { CallAssistCallRecord } from "./call-record.js";

// ---------------------------------------------------------------------------
// Feature flag gate
// ---------------------------------------------------------------------------

export function isSrAnalyticsEnabled(
  config: { srAnalyticsEnabled?: boolean } | null | undefined,
): boolean {
  return config?.srAnalyticsEnabled === true;
}

// ---------------------------------------------------------------------------
// Aggregation types
// ---------------------------------------------------------------------------

export type DepartmentVolume = {
  department: string;
  displayName?: string;
  total: number;
  open: number;
  closed: number;
  escalated: number;
};

export type SlaAdherenceRow = {
  department: string;
  displayName?: string;
  /** Count of SRs resolved within SLA. */
  withinSla: number;
  /** Count of SRs that exceeded SLA. */
  exceededSla: number;
  /** Percentage within SLA, 0–100. */
  adherencePct: number;
  /** Average resolution time in minutes across closed/resolved SRs. */
  avgResolutionMinutes?: number;
};

export type ChannelMixRow = {
  channel: string;
  count: number;
  pct: number;
};

export type EscalationRateRow = {
  department: string;
  total: number;
  escalated: number;
  ratePct: number;
};

export type SrAnalyticsSummary = {
  agencyId: string;
  /** ISO 8601 start of the report window. */
  windowStart: string;
  /** ISO 8601 end of the report window. */
  windowEnd: string;
  totalSrs: number;
  openSrs: number;
  closedSrs: number;
  escalatedSrs: number;
  avgResolutionMinutes?: number;
  departmentVolumes: DepartmentVolume[];
  slaAdherence: SlaAdherenceRow[];
  channelMix: ChannelMixRow[];
  escalationRates: EscalationRateRow[];
};

// ---------------------------------------------------------------------------
// Terminal and open status sets
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(["CLOSED", "CANCELLED", "DUPLICATE"]);
const OPEN_STATUSES = new Set([
  "OPEN", "ROUTED", "ACKNOWLEDGED", "IN_PROGRESS",
  "AWAITING_INFORMATION", "PENDING_REOPEN", "ESCALATED",
]);

// ---------------------------------------------------------------------------
// Core aggregation
// ---------------------------------------------------------------------------

type RecordWithExtras = CallAssistCallRecord & {
  statusHistory?: Array<{ at?: string }>;
  escalationCount?: number;
  channel?: string;
};

/**
 * Aggregate an array of call records into a summary analytics object.
 * Input records must all belong to the same `agencyId`.
 * SLA minutes map is used to determine whether each closed SR met its SLA.
 */
export function aggregateSrAnalytics(opts: {
  agencyId: string;
  records: CallAssistCallRecord[];
  windowStart: string;
  windowEnd: string;
  /** Map of department → SLA in minutes. Used for adherence calculation. */
  departmentSlaMins: Record<string, number>;
  /** Optional display name map. */
  departmentNames?: Record<string, string>;
}): SrAnalyticsSummary {
  const { agencyId, records, windowStart, windowEnd, departmentSlaMins, departmentNames = {} } = opts;

  // Filter by time window
  const inWindow = records.filter((r) => {
    const ca = r.createdAt;
    if (!ca) return false;
    return ca >= windowStart && ca <= windowEnd;
  });

  const deptMap = new Map<string, { total: number; open: number; closed: number; escalated: number; resolutionMins: number[]; slaOk: number; slaFail: number }>();
  const channelCounts = new Map<string, number>();

  let totalOpen = 0;
  let totalClosed = 0;
  let totalEscalated = 0;
  const globalResolutionMins: number[] = [];

  for (const r of inWindow) {
    const rec = r as RecordWithExtras;
    const dept = r.department ?? "UNKNOWN";

    if (!deptMap.has(dept)) {
      deptMap.set(dept, { total: 0, open: 0, closed: 0, escalated: 0, resolutionMins: [], slaOk: 0, slaFail: 0 });
    }
    const d = deptMap.get(dept)!;
    d.total++;

    if (TERMINAL_STATUSES.has(r.status) && r.status !== "CANCELLED") {
      d.closed++;
      totalClosed++;
    } else if (OPEN_STATUSES.has(r.status)) {
      d.open++;
      totalOpen++;
    }

    if (r.status === "ESCALATED" || (rec.escalationCount ?? 0) > 0) {
      d.escalated++;
      totalEscalated++;
    }

    // Resolution time
    if (TERMINAL_STATUSES.has(r.status) && r.createdAt && r.updatedAt) {
      const mins = (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 60_000;
      if (mins >= 0) {
        d.resolutionMins.push(mins);
        globalResolutionMins.push(mins);
        const sla = departmentSlaMins[dept] ?? 1440;
        if (mins <= sla) d.slaOk++; else d.slaFail++;
      }
    }

    // Channel mix
    const ch = rec.channel ?? "unknown";
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
  }

  const totalSrs = inWindow.length;

  // Build department volumes
  const departmentVolumes: DepartmentVolume[] = [];
  const slaAdherence: SlaAdherenceRow[] = [];
  const escalationRates: EscalationRateRow[] = [];

  for (const [deptId, d] of deptMap.entries()) {
    departmentVolumes.push({
      department: deptId,
      displayName: departmentNames[deptId],
      total: d.total,
      open: d.open,
      closed: d.closed,
      escalated: d.escalated,
    });

    const slaTotal = d.slaOk + d.slaFail;
    slaAdherence.push({
      department: deptId,
      displayName: departmentNames[deptId],
      withinSla: d.slaOk,
      exceededSla: d.slaFail,
      adherencePct: slaTotal === 0 ? 100 : Math.round((d.slaOk / slaTotal) * 100),
      avgResolutionMinutes:
        d.resolutionMins.length > 0
          ? Math.round(d.resolutionMins.reduce((a, b) => a + b, 0) / d.resolutionMins.length)
          : undefined,
    });

    escalationRates.push({
      department: deptId,
      total: d.total,
      escalated: d.escalated,
      ratePct: d.total === 0 ? 0 : Math.round((d.escalated / d.total) * 100),
    });
  }

  // Channel mix
  const channelMix: ChannelMixRow[] = [];
  for (const [ch, count] of channelCounts.entries()) {
    channelMix.push({
      channel: ch,
      count,
      pct: totalSrs === 0 ? 0 : Math.round((count / totalSrs) * 100),
    });
  }
  channelMix.sort((a, b) => b.count - a.count);

  // Sort department volumes by total desc
  departmentVolumes.sort((a, b) => b.total - a.total);
  slaAdherence.sort((a, b) => a.adherencePct - b.adherencePct); // worst first
  escalationRates.sort((a, b) => b.ratePct - a.ratePct);

  const avgResolutionMinutes =
    globalResolutionMins.length > 0
      ? Math.round(globalResolutionMins.reduce((a, b) => a + b, 0) / globalResolutionMins.length)
      : undefined;

  return {
    agencyId,
    windowStart,
    windowEnd,
    totalSrs,
    openSrs: totalOpen,
    closedSrs: totalClosed,
    escalatedSrs: totalEscalated,
    avgResolutionMinutes,
    departmentVolumes,
    slaAdherence,
    channelMix,
    escalationRates,
  };
}

// ---------------------------------------------------------------------------
// Trend helpers
// ---------------------------------------------------------------------------

/** Bucket label used in trend charts. */
export type TrendBucket = {
  label: string; // ISO date "YYYY-MM-DD"
  count: number;
};

/**
 * Bucket SRs by creation date into daily counts within a window.
 * Returns an entry for every day in [windowStart, windowEnd], including zeros.
 */
export function dailyVolumeTrend(opts: {
  records: CallAssistCallRecord[];
  windowStart: string;
  windowEnd: string;
}): TrendBucket[] {
  const counts = new Map<string, number>();
  for (const r of opts.records) {
    const date = (r.createdAt ?? "").slice(0, 10);
    if (date >= opts.windowStart.slice(0, 10) && date <= opts.windowEnd.slice(0, 10)) {
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }

  // Fill in zeros for missing days
  const result: TrendBucket[] = [];
  const start = new Date(opts.windowStart);
  const end = new Date(opts.windowEnd);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const label = d.toISOString().slice(0, 10);
    result.push({ label, count: counts.get(label) ?? 0 });
  }
  return result;
}
