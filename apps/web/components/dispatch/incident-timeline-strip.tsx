"use client";

import type { AIAnalysis, Incident, TranscriptSegment } from "rapid-cortex-shared";
import { confidenceToDisplayPercent } from "rapid-cortex-shared";
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
      <div className="shrink-0 border-b px-4 py-2 text-xs text-[var(--rc-text-muted)]" style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg)" }}>
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
      sub: analysis
        ? `${confidenceToDisplayPercent(analysis.confidence)}% · ${analysis.urgency}`
        : "Pending",
    },
  ];
  if (incident.cadLastSyncAt) {
    items.push({
      key: "cad",
      label: "CAD sync",
      sub: formatRelativeOpened(incident.cadLastSyncAt),
    });
  }
  if (incident.cadNatureCode) {
    items.push({
      key: "nature",
      label: "CAD nature",
      sub: incident.cadNatureCode,
    });
  }
  if (incident.cadBeat) {
    items.push({
      key: "beat",
      label: "Beat",
      sub: incident.cadBeat,
    });
  }
  if (incident.cadDuplicateOfCadNumber) {
    items.push({
      key: "dup",
      label: "Duplicate of",
      sub: incident.cadDuplicateOfCadNumber,
    });
  }
  if ((incident.cadRelatedCadNumbers ?? []).length > 0) {
    items.push({
      key: "rel",
      label: "Related CFS",
      sub: (incident.cadRelatedCadNumbers ?? []).slice(0, 3).join(", "),
    });
  }

  return (
    <div className="shrink-0 border-b px-4 py-2" style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg)" }}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--rc-text-muted)]">
        Session timeline
      </div>
      <div className="flex flex-wrap gap-4">
        {items.map((it) => (
          <div key={it.key} className="min-w-[7rem]">
            <div className="text-[10px] uppercase tracking-wide text-[var(--rc-text-muted)]">{it.label}</div>
            <div className="text-xs font-medium text-[var(--rc-text)]">{it.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
