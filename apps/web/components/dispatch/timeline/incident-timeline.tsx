"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { TimelineEventKind } from "rapid-cortex-shared";
import { TimelineEventRow } from "@/components/dispatch/timeline/timeline-event-row";
import {
  exportIncidentTimeline,
  fetchIncidentTimeline,
  isIncidentTimelineApiConfigured,
  postIncidentTimelineNote,
} from "@/lib/incident-timeline-api";

const ALL_KINDS: TimelineEventKind[] = [
  "call_received",
  "transcription_started",
  "ai_analysis_created",
  "unit_dispatched",
  "unit_status_changed",
  "cad_synced",
  "supervisor_joined",
  "translation_activated",
  "media_requested",
  "media_received",
  "manual_override",
  "dispatcher_note",
  "hospital_prealert_sent",
  "hospital_prealert_acknowledged",
  "hospital_prealert_failed",
  "hospital_prealert_cancelled",
  "call_ended",
  "incident_closed",
];

export function IncidentTimeline({ incidentId }: { incidentId: string }) {
  const qc = useQueryClient();
  const [kindFilter, setKindFilter] = useState<TimelineEventKind | "">("");
  const [actorFilter, setActorFilter] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timelineQuery = useQuery({
    queryKey: ["incident-timeline", incidentId],
    queryFn: () => fetchIncidentTimeline(incidentId),
    enabled: isIncidentTimelineApiConfigured() && Boolean(incidentId),
  });

  const events = useMemo(() => {
    let rows = [...(timelineQuery.data ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (kindFilter) rows = rows.filter((e) => e.kind === kindFilter);
    if (actorFilter.trim()) rows = rows.filter((e) => (e.actorId ?? "").includes(actorFilter.trim()));
    return rows;
  }, [timelineQuery.data, kindFilter, actorFilter]);

  const exportJson = async () => {
    setError(null);
    setBusy(true);
    try {
      const data = await exportIncidentTimeline(incidentId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `incident-${incidentId}-timeline.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await postIncidentTimelineNote(incidentId, note.trim());
      setNote("");
      await qc.invalidateQueries({ queryKey: ["incident-timeline", incidentId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="incident-timeline space-y-4 print:bg-white print:text-black">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <label className="text-xs text-slate-400">
            Kind
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as TimelineEventKind | "")}
              className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            >
              <option value="">All kinds</option>
              {ALL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Actor
            <input
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder="user id"
              className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportJson()}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          Export for compliance
        </button>
      </div>

      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border border-slate-700/60 bg-slate-950/80 p-3 print:hidden">
        <label className="block text-xs text-slate-400">
          Add dispatcher note to timeline
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
          />
        </label>
        <button
          type="button"
          disabled={busy || !note.trim()}
          onClick={() => void addNote()}
          className="mt-2 rounded-md bg-slate-800 px-2 py-1 text-xs text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
        >
          Add note
        </button>
      </div>

      {timelineQuery.isLoading ? <p className="text-sm text-slate-500">Loading timeline…</p> : null}
      {timelineQuery.isError ? (
        <p className="text-sm text-rose-300">{(timelineQuery.error as Error).message}</p>
      ) : null}

      <ol className="space-y-2">
        {events.map((event) => (
          <TimelineEventRow key={event.eventId} event={event} />
        ))}
      </ol>
      {!timelineQuery.isLoading && events.length === 0 ? (
        <p className="text-sm text-slate-500">No timeline events recorded for this incident yet.</p>
      ) : null}
    </div>
  );
}
