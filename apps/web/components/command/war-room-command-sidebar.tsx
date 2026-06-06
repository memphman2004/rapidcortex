"use client";

import { useQuery } from "@tanstack/react-query";
import type { Incident } from "rapid-cortex-shared";
import { CallerMediaGallery } from "@/components/dispatch/caller-media-gallery";
import { deleteCallerMedia, fetchCallerMedia, isCallerMediaApiConfigured } from "@/lib/caller-media-api";
import { loadIncident } from "@/lib/queries";
import { isIncidentMediaEnabled } from "@/lib/runtime-flags";

export function WarRoomCommandSidebar({ incidentId }: { incidentId: string }) {
  const incidentQuery = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: () => loadIncident(incidentId),
    enabled: Boolean(incidentId),
  });

  const mediaQuery = useQuery({
    queryKey: ["caller-media", incidentId],
    queryFn: () => fetchCallerMedia(incidentId),
    enabled: Boolean(incidentId) && isIncidentMediaEnabled() && isCallerMediaApiConfigured(),
    refetchInterval: 15_000,
  });

  const incident = incidentQuery.data;

  return (
    <div className="space-y-4 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Units</h3>
        {incidentQuery.isLoading ? <p className="mt-1 text-xs text-slate-500">Loading…</p> : null}
        {incident ? (
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {(incident.cadUnits ?? []).length > 0 ? (
              incident.cadUnits!.map((u) => (
                <li key={u} className="font-mono">
                  {u}
                </li>
              ))
            ) : (
              <li className="text-slate-500">No units assigned yet.</li>
            )}
            {incident.cadLastSyncAt ? (
              <li className="text-[10px] text-slate-500">CAD sync {incident.cadLastSyncAt}</li>
            ) : null}
          </ul>
        ) : null}
      </section>

      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">AI briefing</h3>
        <p className="mt-2 text-xs text-slate-300">
          {incident?.summary?.trim() || "No AI summary on incident record yet."}
        </p>
        {incident?.title ? <p className="mt-1 text-[11px] text-slate-500">{incident.title}</p> : null}
      </section>

      {isIncidentMediaEnabled() && isCallerMediaApiConfigured() ? (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Caller media</h3>
          <div className="mt-2">
            {mediaQuery.isLoading ? <p className="text-xs text-slate-500">Loading…</p> : null}
            {mediaQuery.data ? (
              <CallerMediaGallery
                incidentId={incidentId}
                items={mediaQuery.data}
                onDelete={async (mediaId) => {
                  await deleteCallerMedia(incidentId, mediaId);
                  await mediaQuery.refetch();
                }}
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
