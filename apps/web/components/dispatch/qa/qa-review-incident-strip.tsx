"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { QaCoachingCard } from "@/components/dispatch/qa/qa-coaching-card";
import { QaScorecard } from "@/components/dispatch/qa/qa-scorecard";
import { QaStatusBadge } from "@/components/dispatch/qa/qa-status-badge";
import { fetchQaSessions, isApiConfigured } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isQaScoringEnabled } from "@/lib/runtime-flags";
import type { QASession, TranscriptSegment } from "rapid-cortex-shared";

export function QaReviewIncidentStrip({
  incidentId,
  transcript,
}: {
  incidentId: string;
  transcript: TranscriptSegment[];
}) {
  const to = useJurisdictionLink();
  const q = useQuery({
    queryKey: ["qa-sessions", "incident", incidentId],
    queryFn: fetchQaSessions,
    enabled: isQaScoringEnabled() && isApiConfigured(),
    select: (rows) => rows.filter((s) => s.incidentId === incidentId),
  });

  if (!isQaScoringEnabled() || !isApiConfigured()) return null;

  const rows = q.data ?? [];
  if (q.isLoading) {
    return (
      <div className="shrink-0 border-b border-slate-800 bg-slate-950/50 px-4 py-2 text-xs text-slate-500">
        Loading QA sessions…
      </div>
    );
  }
  if (rows.length === 0) return null;

  const latest = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;

  return (
    <div className="shrink-0 border-b border-slate-800 bg-slate-950/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">QA for this incident</h2>
        <Link
          href={to("/supervisor/qa")}
          className="text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:underline"
        >
          Open QA queue
        </Link>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {rows.map((s) => (
          <li key={s.sessionId}>
            <Link
              href={to(`/supervisor/qa/${encodeURIComponent(s.sessionId)}`)}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-700 hover:bg-slate-800"
            >
              <span className="font-mono text-[10px] text-slate-500">{s.sessionId.slice(0, 18)}…</span>
              <QaStatusBadge status={s.status} />
              {s.aggregateScore != null ? (
                <span className="font-mono text-[11px] text-slate-300">{s.aggregateScore}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {latest.status === "scored" || latest.status === "reviewed" ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <QaScorecard session={latest} transcriptPreview={transcript} />
          <QaCoachingCard session={latest} />
        </div>
      ) : null}
    </div>
  );
}
