import type { SopIntelligenceCoachingPriority } from "./schemas.js";

export type SopIntelligencePatternSummary = {
  sopId: string;
  stepId: string;
  sopTitle: string;
  gapCount: number;
};

export type SopIntelligenceReportSummary = {
  reportId: string;
  dispatcherName?: string;
  sopId?: string;
  stepId?: string;
  callId: string;
  createdAt: string;
  gapDescription?: string;
};

export type SopIntelligenceCoachingItem = {
  coachingId: string;
  dispatcherName: string;
  sopId: string;
  stepId: string;
  sopTitle: string;
  reportCount: number;
  latestCallId: string;
  latestAt: string;
  priority: SopIntelligenceCoachingPriority;
  summary: string;
};

function priorityForCount(count: number): SopIntelligenceCoachingPriority {
  if (count >= 3) return "priority";
  if (count >= 2) return "due";
  return "watch";
}

/** Build the coaching queue from live pattern counters + SOP-gap reports (no static rows). */
export function deriveSopIntelligenceCoaching(
  patterns: readonly SopIntelligencePatternSummary[],
  reports: readonly SopIntelligenceReportSummary[],
): SopIntelligenceCoachingItem[] {
  const titleByKey = new Map(patterns.map((p) => [`${p.sopId}#${p.stepId}`, p.sopTitle]));
  const grouped = new Map<string, SopIntelligenceReportSummary[]>();
  for (const report of reports) {
    if (!report.sopId || !report.stepId) continue;
    const dispatcher = report.dispatcherName?.trim() || "Unknown dispatcher";
    const key = `${dispatcher}#${report.sopId}#${report.stepId}`;
    const list = grouped.get(key) ?? [];
    list.push(report);
    grouped.set(key, list);
  }

  const items: SopIntelligenceCoachingItem[] = [];
  for (const [key, list] of grouped) {
    const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = sorted[0];
    if (!latest?.sopId || !latest.stepId) continue;
    const [dispatcherName] = key.split("#");
    const count = sorted.length;
    items.push({
      coachingId: key,
      dispatcherName: dispatcherName || "Unknown dispatcher",
      sopId: latest.sopId,
      stepId: latest.stepId,
      sopTitle: titleByKey.get(`${latest.sopId}#${latest.stepId}`) ?? `SOP ${latest.sopId}`,
      reportCount: count,
      latestCallId: latest.callId,
      latestAt: latest.createdAt,
      priority: priorityForCount(count),
      summary:
        latest.gapDescription?.trim() ||
        `${count} SOP-gap report${count === 1 ? "" : "s"} on ${latest.sopId} step ${latest.stepId}`,
    });
  }

  const rank = { priority: 0, due: 1, watch: 2 };
  return items.sort((a, b) => {
    const pr = rank[a.priority] - rank[b.priority];
    if (pr !== 0) return pr;
    return b.reportCount - a.reportCount;
  });
}
