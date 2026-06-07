"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useMemo, useState } from "react";
import { CampusIncidentCard } from "@/components/dispatch/campus/CampusIncidentCard";
import {
  escalateCampusIncident,
  fetchCampusIncidents,
  patchCampusIncident,
} from "@/lib/campus/campus-incidents-api";
import type { CampusIncidentStatus } from "@/lib/campus/types";

type FilterStatus = "all" | CampusIncidentStatus;

export default function CampusDispatcherPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode: campusCodeParam } = use(params);
  const campusCode = campusCodeParam.toUpperCase();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [zoneFilter, setZoneFilter] = useState("");

  const incidentsQuery = useQuery({
    queryKey: ["campus-incidents", campusCode],
    queryFn: () => fetchCampusIncidents(campusCode),
    refetchInterval: 15_000,
  });

  const zones = useMemo(() => {
    const set = new Set<string>();
    for (const row of incidentsQuery.data ?? []) {
      if (row.zoneCode) set.add(row.zoneCode);
      else if (row.roomCode) set.add(row.roomCode);
    }
    return [...set].sort();
  }, [incidentsQuery.data]);

  const filtered = useMemo(() => {
    let rows = incidentsQuery.data ?? [];
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (zoneFilter) rows = rows.filter((r) => (r.zoneCode ?? r.roomCode) === zoneFilter);
    return [...rows].sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (b.status === "open" && a.status !== "open") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [incidentsQuery.data, statusFilter, zoneFilter]);

  const mutate = useMutation({
    mutationFn: async (action: { type: "ack" | "close" | "escalate"; id: string }) => {
      if (action.type === "ack") {
        await patchCampusIncident(campusCode, action.id, { status: "assigned" });
        return;
      }
      if (action.type === "close") {
        await patchCampusIncident(campusCode, action.id, { status: "resolved" });
        return;
      }
      await escalateCampusIncident(campusCode, action.id);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["campus-incidents", campusCode] }),
  });

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-emerald-900/30 bg-emerald-950/15 px-4 py-3">
        <h1 className="text-xl font-semibold text-emerald-50">Campus Safety — {campusCode}</h1>
        <p className="mt-1 max-w-2xl text-sm text-emerald-100/70">
          School and university incident intake from QR and SMS reports. This is not a 911 dispatch
          workstation — escalate to your public safety agency when required.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-300">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            <option value="open">New</option>
            <option value="assigned">Acknowledged</option>
            <option value="responding">Responding</option>
            <option value="resolved">Closed</option>
            <option value="escalated">Escalated</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Zone
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="ml-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          >
            <option value="">All zones</option>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
      </div>

      {incidentsQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading incidents…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          No incidents match the current filters.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((incident) => (
            <CampusIncidentCard
              key={incident.id}
              incident={incident}
              onAcknowledge={(id) => mutate.mutate({ type: "ack", id })}
              onEscalate={(id) => mutate.mutate({ type: "escalate", id })}
              onClose={(id) => mutate.mutate({ type: "close", id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
