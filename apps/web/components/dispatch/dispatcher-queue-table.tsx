"use client";

import type { AggregateConfidence, Incident } from "rapid-cortex-shared";
import { ConfidenceMiniBar } from "@/components/confidence/confidence-mini-bar";
import { formatRelativeOpened } from "@/lib/format";
import { isApiConfigured } from "@/lib/api";
import { TRAINING_MODE_LABEL } from "@/lib/training-mode";

function priorityFromUrgency(u: Incident["urgency"]): "p1" | "p2" | "p3" {
  if (u === "critical") return "p1";
  if (u === "high") return "p2";
  return "p3";
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function DispatcherQueueTable({
  incidents,
  selectedId,
  onSelect,
  isLoading,
  emptyHint,
  selectedFieldConfidenceAggregate = null,
}: {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  emptyHint?: string;
  selectedFieldConfidenceAggregate?: AggregateConfidence | null;
}) {
  if (isLoading) {
    return (
      <div className="space-y-1 p-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 animate-pulse bg-[var(--rc-panel-alt)]" />
        ))}
      </div>
    );
  }
  if (incidents.length === 0) {
    return (
      <p className="p-2 text-[12px] text-[var(--rc-text-muted)]">
        {emptyHint
          ? emptyHint
          : isApiConfigured()
            ? "No open incidents."
            : `${TRAINING_MODE_LABEL}: sample queue only.`}
      </p>
    );
  }

  return (
    <div>
      {incidents.map((inc) => {
        const pri = priorityFromUrgency(inc.urgency);
        const sel = inc.incidentId === selectedId;
        return (
          <button
            key={inc.incidentId}
            type="button"
            onClick={() => onSelect(inc.incidentId)}
            className={`ws-queue-row w-full text-left ${sel ? "selected" : ""}`}
          >
            <span className={`ws-priority ${pri} self-center`}>{pri.toUpperCase()}</span>
            <span className="self-center font-mono text-[11px] tabular-nums text-[var(--rc-text-muted)]">
              {formatClock(inc.createdAt)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-medium text-[var(--rc-text)]">
                {inc.title || inc.category.replace(/_/g, " ")}
              </span>
              <span className="block truncate text-[11px] text-[var(--rc-text-muted)]">
                {inc.callerAddressLine?.trim() || "Location pending"}
              </span>
              {sel && selectedFieldConfidenceAggregate ? (
                <ConfidenceMiniBar aggregate={selectedFieldConfidenceAggregate} />
              ) : null}
            </span>
            <span className="self-center text-right font-mono text-[10px] text-[var(--rc-text-muted)]">
              {formatRelativeOpened(inc.createdAt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
