"use client";

import type { QASession } from "rapid-cortex-shared";
import { QaStatusBadge } from "@/components/dispatch/qa/qa-status-badge";

function rank(s: QASession): number {
  switch (s.status) {
    case "reviewed":
      return 5;
    case "scored":
      return 4;
    case "scoring":
      return 3;
    case "draft":
      return 2;
    case "failed":
      return 1;
    default:
      return 0;
  }
}

/** Compact QA signal for supervisor review queues (one incident may have multiple sessions; pick highest-status). */
export function QaReviewIncidentBadge({ sessions }: { sessions: QASession[] }) {
  if (sessions.length === 0) return null;
  const primary = [...sessions].sort((a, b) => {
    const dr = rank(b) - rank(a);
    if (dr !== 0) return dr;
    return b.updatedAt.localeCompare(a.updatedAt);
  })[0]!;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-md bg-slate-900/80 px-1.5 py-0.5 ring-1 ring-slate-700">
      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">QA</span>
      <QaStatusBadge status={primary.status} />
      {primary.aggregateScore != null && (primary.status === "scored" || primary.status === "reviewed") ? (
        <span className="font-mono text-[10px] font-semibold text-slate-200">{primary.aggregateScore}</span>
      ) : null}
    </span>
  );
}
