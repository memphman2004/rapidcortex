"use client";

import type { Incident } from "rapid-cortex-shared";
import { IncidentCard } from "@/components/dispatch/incident-card";
import { isApiConfigured } from "@/lib/api";
import { TRAINING_MODE_LABEL } from "@/lib/training-mode";

export function IncidentQueue({
  incidents,
  selectedId,
  onSelect,
  isLoading,
  compact = false,
  emptyHint,
  sectionTitle = "Active incidents",
  outerClassName,
}: {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  /** When true, omit fixed width / outer border (parent provides queue chrome). */
  compact?: boolean;
  /** Shown when the filtered list is empty (e.g. non-emergency tab). */
  emptyHint?: string;
  /** Override queue section header (e.g. CAD workbench “My queue”). */
  sectionTitle?: string;
  /** Optional outer wrapper classes (CAD layout passes panel chrome). */
  outerClassName?: string;
}) {
  return (
    <aside
      className={
        outerClassName ??
        `flex shrink-0 flex-col bg-slate-900/40 ${
          compact ? "min-h-0 w-full flex-1" : "w-72 border-r border-slate-800"
        }`
      }
    >
      <div className="border-b border-slate-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
          {sectionTitle}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg bg-slate-800/80"
              />
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <p className="p-3 text-sm text-slate-300">
            {emptyHint
              ? emptyHint
              : isApiConfigured()
                ? "No open incidents for your agency. Create one from your operational workflow (or admin tools) when available."
                : `${TRAINING_MODE_LABEL}: sample incidents only — configure the API for live agency data.`}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {incidents.map((inc) => (
              <li key={inc.incidentId}>
                <IncidentCard
                  incident={inc}
                  selected={inc.incidentId === selectedId}
                  onSelect={() => onSelect(inc.incidentId)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
