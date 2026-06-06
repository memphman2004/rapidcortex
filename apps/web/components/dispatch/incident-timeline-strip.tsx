"use client";

import type { AIAnalysis, Incident, TranscriptSegment } from "rapid-cortex-shared";
import { formatRelativeOpened } from "@/lib/format";

export function IncidentTimelineStrip({
  incident,
  segments,
  analysis,
}: {
  incident: Incident | null | undefined;
  segments: TranscriptSegment[];
  analysis: AIAnalysis | null | undefined;
}) {
  if (!incident) {
    return (
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/30 px-4 py-2 text-xs text-slate-500">
        Select an incident to view session timeline.
      </div>
    );
  }

  const items: { key: string; label: string; sub: string }[] = [
    {
      key: "opened",
      label: "Opened",
      sub: formatRelativeOpened(incident.createdAt),
    },
    {
      key: "updated",
      label: "Last update",
      sub: formatRelativeOpened(incident.updatedAt),
    },
    {
      key: "tx",
      label: "Transcript",
      sub: `${segments.length} segment${segments.length === 1 ? "" : "s"}`,
    },
    {
      key: "ai",
      label: "AI triage",
      sub: analysis ? `${Math.round(analysis.confidence * 100)}% · ${analysis.urgency}` : "Pending",
    },
  ];

  return (
    <div className="shrink-0 border-b border-slate-800 bg-slate-900/40 px-4 py-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Session timeline
      </div>
      <div className="flex flex-wrap gap-4">
        {items.map((it) => (
          <div key={it.key} className="min-w-[7rem]">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{it.label}</div>
            <div className="text-xs font-medium text-slate-200">{it.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
