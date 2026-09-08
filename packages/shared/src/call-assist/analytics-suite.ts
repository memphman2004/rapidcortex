import { z } from "zod";

export const callAssistAnalyticsFilterSchema = z.object({
  from: z.string().min(1).max(40).optional(),
  to: z.string().min(1).max(40).optional(),
  shift: z.string().max(80).optional(),
  dispatcherId: z.string().max(128).optional(),
  language: z.string().max(16).optional(),
  location: z.string().max(120).optional(),
  routingDestination: z.string().max(80).optional(),
});
export type CallAssistAnalyticsFilter = z.infer<typeof callAssistAnalyticsFilterSchema>;

export type CallAssistAnalyticsSession = {
  sessionId: string;
  state: string;
  createdAt: string;
  completedAt?: string;
  language?: string;
  shiftLabel?: string;
  dispatcherId?: string;
  zoneName?: string;
  locationText?: string;
  routingDestinationType?: string;
  humanTakeover?: boolean;
  falseTransferSuspected?: boolean;
  smsStatus?: string;
  onlineReportingEligible?: boolean;
  surveyScore?: number;
};

export type CallAssistHeatCell = { key: string; label: string; count: number };

export type CallAssistAnalyticsDashboard = {
  generatedAt: string;
  window: { from: string; to: string; sessionCount: number };
  ahtSeconds: number | null;
  containmentRate: number | null;
  abandonmentRate: number | null;
  queueDepthCurrent: number;
  queueDepthPeak: number;
  csatAverage: number | null;
  csatCount: number;
  falseTransferRate: number | null;
  humanTakeoverRate: number | null;
  onlineReportingDiversionRate: number | null;
  selfServiceCompletionRate: number | null;
  heatMaps: {
    location: CallAssistHeatCell[];
    language: CallAssistHeatCell[];
    routing: CallAssistHeatCell[];
    hourOfDay: CallAssistHeatCell[];
  };
  filters: CallAssistAnalyticsFilter;
};

function inWindow(iso: string, fromMs: number, toMs: number): boolean {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= fromMs && t <= toMs;
}

function matchesFilter(row: CallAssistAnalyticsSession, filter: CallAssistAnalyticsFilter): boolean {
  if (filter.shift && (row.shiftLabel ?? "") !== filter.shift) return false;
  if (filter.dispatcherId && (row.dispatcherId ?? "") !== filter.dispatcherId) return false;
  if (filter.language && (row.language ?? "") !== filter.language) return false;
  if (filter.location) {
    const loc = `${row.zoneName ?? ""} ${row.locationText ?? ""}`.toLowerCase();
    if (!loc.includes(filter.location.toLowerCase())) return false;
  }
  if (filter.routingDestination && (row.routingDestinationType ?? "") !== filter.routingDestination) {
    return false;
  }
  return true;
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function countBy(rows: CallAssistAnalyticsSession[], keyFn: (r: CallAssistAnalyticsSession) => string): CallAssistHeatCell[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row) || "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);
}

export function sessionHandleSeconds(row: CallAssistAnalyticsSession): number | null {
  if (!row.completedAt) return null;
  const start = Date.parse(row.createdAt);
  const end = Date.parse(row.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

export function isAbandoned(row: CallAssistAnalyticsSession): boolean {
  return row.state === "FAILED" || (row.state !== "COMPLETED" && row.state !== "SURVEY" && !row.completedAt);
}

export function isContained(row: CallAssistAnalyticsSession): boolean {
  if (row.state !== "COMPLETED" && row.state !== "SURVEY") return false;
  if (row.humanTakeover) return false;
  const dest = row.routingDestinationType ?? "";
  return dest !== "EMERGENCY_911" && dest !== "CALL_TAKER";
}

export function peakConcurrent(rows: CallAssistAnalyticsSession[]): number {
  const events: Array<{ t: number; d: number }> = [];
  for (const row of rows) {
    const start = Date.parse(row.createdAt);
    if (!Number.isFinite(start)) continue;
    const end = row.completedAt ? Date.parse(row.completedAt) : start + 15 * 60_000;
    events.push({ t: start, d: 1 });
    events.push({ t: Number.isFinite(end) ? end : start, d: -1 });
  }
  events.sort((a, b) => a.t - b.t || a.d - b.d);
  let current = 0;
  let peak = 0;
  for (const e of events) {
    current += e.d;
    if (current > peak) peak = current;
  }
  return peak;
}

export function computeCallAssistAnalytics(opts: {
  sessions: CallAssistAnalyticsSession[];
  openSessions: CallAssistAnalyticsSession[];
  filter?: CallAssistAnalyticsFilter;
  nowMs?: number;
}): CallAssistAnalyticsDashboard {
  const now = opts.nowMs ?? Date.now();
  const filter = opts.filter ?? {};
  const fromMs = filter.from ? Date.parse(filter.from) : now - 7 * 86_400_000;
  const toMs = filter.to ? Date.parse(filter.to) : now;
  const windowed = opts.sessions.filter((s) => inWindow(s.createdAt, fromMs, toMs)).filter((s) => matchesFilter(s, filter));
  const open = opts.openSessions.filter((s) => matchesFilter(s, filter));
  const handled = windowed.filter(
    (s) => s.state === "COMPLETED" || s.state === "SURVEY" || (Boolean(s.completedAt) && s.state !== "FAILED"),
  );
  const handles = handled.map(sessionHandleSeconds).filter((n): n is number => n != null);
  const surveys = windowed.map((s) => s.surveyScore).filter((n): n is number => typeof n === "number");
  const smsOffered = windowed.filter((s) => s.onlineReportingEligible || s.smsStatus);
  const smsSent = windowed.filter((s) => s.smsStatus === "SENT" || s.smsStatus === "CLICKED" || s.smsStatus === "COMPLETED");
  const smsDone = windowed.filter((s) => s.smsStatus === "COMPLETED");

  return {
    generatedAt: new Date(now).toISOString(),
    window: {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      sessionCount: windowed.length,
    },
    ahtSeconds: mean(handles),
    containmentRate: rate(handled.filter(isContained).length, handled.length),
    abandonmentRate: rate(windowed.filter(isAbandoned).length, windowed.length),
    queueDepthCurrent: open.filter((s) =>
      ["INTAKE", "LISTENING", "TRIAGED", "CALLBACK_OFFERED", "CALLBACK_QUEUED", "CALLBACK_IN_PROGRESS"].includes(s.state),
    ).length,
    queueDepthPeak: peakConcurrent(windowed),
    csatAverage: mean(surveys),
    csatCount: surveys.length,
    falseTransferRate: rate(windowed.filter((s) => s.falseTransferSuspected).length, windowed.length),
    humanTakeoverRate: rate(windowed.filter((s) => s.humanTakeover).length, windowed.length),
    onlineReportingDiversionRate: rate(smsSent.length, smsOffered.length || windowed.length),
    selfServiceCompletionRate: rate(smsDone.length, smsSent.length),
    heatMaps: {
      location: countBy(windowed, (s) => s.zoneName?.trim() || s.locationText?.trim() || "unspecified"),
      language: countBy(windowed, (s) => s.language?.trim() || "und"),
      routing: countBy(windowed, (s) => s.routingDestinationType?.trim() || s.state),
      hourOfDay: countBy(windowed, (s) => {
        const t = Date.parse(s.createdAt);
        return Number.isFinite(t) ? String(new Date(t).getUTCHours()).padStart(2, "0") : "??";
      }),
    },
    filters: filter,
  };
}
