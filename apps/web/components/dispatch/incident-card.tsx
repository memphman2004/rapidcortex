"use client";

import type { AggregateConfidence, Incident } from "rapid-cortex-shared";
import { CategoryBadge, StatusBadge, UrgencyBadge } from "@/components/dispatch/badges";
import { ConfidenceMiniBar } from "@/components/confidence/confidence-mini-bar";
import { formatRelativeOpened } from "@/lib/format";

export function IncidentCard({
  incident,
  selected,
  onSelect,
  fieldConfidenceAggregate = null,
}: {
  incident: Incident;
  selected: boolean;
  onSelect: () => void;
  fieldConfidenceAggregate?: AggregateConfidence | null;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-sky-600 bg-slate-800 ring-1 ring-sky-700/60"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/80"
      }`}
    >
      <div className="font-mono text-[11px] text-slate-500">{incident.incidentId}</div>
      <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-100">{incident.title}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        <CategoryBadge value={incident.category} />
        <UrgencyBadge value={incident.urgency} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <StatusBadge value={incident.status} />
        <span className="text-[11px] text-slate-500">{formatRelativeOpened(incident.createdAt)}</span>
      </div>
      {fieldConfidenceAggregate ? (
        <div className="mt-2">
          <ConfidenceMiniBar aggregate={fieldConfidenceAggregate} />
        </div>
      ) : null}
    </button>
  );
}
