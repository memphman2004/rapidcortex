"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ChannelDiscipline } from "rapid-cortex-shared";
import {
  assignIncidentChannel,
  CHANNEL_DISCIPLINE_OPTIONS,
  fetchAgencyChannels,
  fetchIncidentChannels,
  isApiConfigured,
  patchIncidentChannelNotes,
  removeIncidentChannelAssignment,
} from "@/lib/api";

function disciplineLabel(d: ChannelDiscipline | string): string {
  return CHANNEL_DISCIPLINE_OPTIONS.find((o) => o.value === d)?.label ?? d;
}

function disciplineBadgeClass(d: ChannelDiscipline | string): string {
  switch (d) {
    case "law":
      return "bg-blue-500/15 text-blue-200 ring-blue-500/30";
    case "fire":
      return "bg-orange-500/15 text-orange-100 ring-orange-500/30";
    case "ems":
    case "ems_medical":
      return "bg-emerald-500/15 text-emerald-100 ring-emerald-500/30";
    case "tactical":
      return "bg-rose-500/15 text-rose-100 ring-rose-500/30";
    case "command":
      return "bg-violet-500/15 text-violet-100 ring-violet-500/30";
    default:
      return "bg-slate-600/20 text-slate-300 ring-slate-500/30";
  }
}

type Props = {
  incidentId: string;
};

export function ChannelMonitorPanel({ incidentId }: Props) {
  const queryClient = useQueryClient();
  const [assignChannelId, setAssignChannelId] = useState("");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const assignmentsQuery = useQuery({
    queryKey: ["incident-channels", incidentId],
    queryFn: () => fetchIncidentChannels(incidentId),
    enabled: isApiConfigured() && Boolean(incidentId),
  });

  const channelsQuery = useQuery({
    queryKey: ["agency-channels"],
    queryFn: () => fetchAgencyChannels(),
    enabled: isApiConfigured(),
  });

  const assignments = assignmentsQuery.data?.assignments ?? [];
  const configuredChannels = (channelsQuery.data?.channels ?? []).filter((c) => c.active);

  const availableToAssign = useMemo(() => {
    const assigned = new Set(assignments.map((a) => a.channelId));
    return configuredChannels.filter((c) => !assigned.has(c.channelId));
  }, [assignments, configuredChannels]);

  const assignMutation = useMutation({
    mutationFn: (channelId: string) => assignIncidentChannel(incidentId, { channelId }),
    onSuccess: () => {
      setAssignChannelId("");
      void queryClient.invalidateQueries({ queryKey: ["incident-channels", incidentId] });
    },
  });

  const notesMutation = useMutation({
    mutationFn: ({ channelId, notes }: { channelId: string; notes: string }) =>
      patchIncidentChannelNotes(incidentId, channelId, { notes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["incident-channels", incidentId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (channelId: string) => removeIncidentChannelAssignment(incidentId, channelId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["incident-channels", incidentId] });
    },
  });

  const colorByChannelId = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const c of configuredChannels) map.set(c.channelId, c.color);
    return map;
  }, [configuredChannels]);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-slate-100 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Channels</h3>
          <span className="rounded-full bg-sky-600/20 px-2 py-0.5 text-[10px] font-medium text-sky-200 ring-1 ring-sky-500/30">
            {assignments.length}
          </span>
        </div>
        {availableToAssign.length > 0 ? (
          <div className="flex items-center gap-1">
            <select
              value={assignChannelId}
              onChange={(e) => setAssignChannelId(e.target.value)}
              className="max-w-[140px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
              aria-label="Select channel to assign"
            >
              <option value="">Assign channel…</option>
              {availableToAssign.map((c) => (
                <option key={c.channelId} value={c.channelId}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!assignChannelId || assignMutation.isPending}
              onClick={() => assignChannelId && assignMutation.mutate(assignChannelId)}
              className="rounded bg-sky-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-600 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        ) : null}
      </div>

      {assignmentsQuery.isLoading ? (
        <p className="text-[11px] text-slate-500">Loading channels…</p>
      ) : assignments.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          No channels assigned. Assign a talk group to track responder communications.
        </p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => {
            const dotColor = colorByChannelId.get(a.channelId) ?? "#64748b";
            const draft = notesDraft[a.channelId] ?? a.notes ?? "";
            const dirty = draft !== (a.notes ?? "");
            return (
              <li
                key={a.channelId}
                className="rounded-md border border-slate-800/80 bg-slate-900/40 px-2 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/10"
                    style={{ backgroundColor: dotColor }}
                    aria-hidden
                  />
                  <span className="text-[12px] font-medium text-slate-100">{a.channelName}</span>
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ring-1 ${disciplineBadgeClass(a.discipline)}`}
                  >
                    {disciplineLabel(a.discipline)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(a.channelId)}
                    disabled={removeMutation.isPending}
                    className="ml-auto text-[10px] text-rose-300/90 hover:text-rose-200"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 flex gap-1">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) =>
                      setNotesDraft((prev) => ({ ...prev, [a.channelId]: e.target.value }))
                    }
                    placeholder="Activity notes (e.g. units redirected at 14:32)"
                    className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
                  />
                  {dirty ? (
                    <button
                      type="button"
                      disabled={notesMutation.isPending}
                      onClick={() =>
                        notesMutation.mutate({ channelId: a.channelId, notes: draft })
                      }
                      className="shrink-0 rounded bg-slate-700 px-2 py-1 text-[10px] text-white hover:bg-slate-600"
                    >
                      Save
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
