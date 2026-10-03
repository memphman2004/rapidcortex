"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RapidVisionPanel } from "@/components/rapid-vision/RapidVisionPanel";
import { useSession } from "@/components/auth/session-context";
import { loadIncidents } from "@/lib/queries";
import { isRapidVisionEnabled } from "@/lib/runtime-flags";

function canVerifyRapidVision(role: string | undefined): boolean {
  const normalized = (role ?? "").toLowerCase();
  return (
    normalized === "dispatcher" ||
    normalized === "supervisor" ||
    normalized === "agencyadmin" ||
    normalized === "command"
  );
}

export default function DispatcherVisionPage() {
  const { user } = useSession();
  const rapidVisionEnabled = isRapidVisionEnabled();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const incidentsQuery = useQuery({
    queryKey: ["incidents", "vision-page"],
    queryFn: loadIncidents,
  });

  const incidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);

  useEffect(() => {
    if (!incidents.length) {
      setSelectedIncidentId(null);
      return;
    }
    if (selectedIncidentId && incidents.some((i) => i.incidentId === selectedIncidentId)) {
      return;
    }
    setSelectedIncidentId(incidents[0]!.incidentId);
  }, [incidents, selectedIncidentId]);

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.incidentId === selectedIncidentId) ?? null,
    [incidents, selectedIncidentId],
  );

  if (!rapidVisionEnabled) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
          NexiQ Vision is currently disabled for this environment.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-white">NexiQ Vision</h1>
        <p className="mt-1 text-sm text-slate-400">
          Live camera intelligence and transcript for the selected incident.
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">
          Incident
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
            value={selectedIncidentId ?? ""}
            onChange={(event) => setSelectedIncidentId(event.target.value || null)}
          >
            {incidents.length === 0 ? (
              <option value="">No active incidents</option>
            ) : (
              incidents.map((incident) => (
                <option key={incident.incidentId} value={incident.incidentId}>
                  {incident.incidentId} · {incident.title}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      {user && selectedIncidentId && selectedIncident ? (
        <div className="min-h-[520px] flex-1">
          <RapidVisionPanel
            incidentId={selectedIncidentId}
            incidentLat={selectedIncident.callerLocationLat ?? 0}
            incidentLng={selectedIncident.callerLocationLng ?? 0}
            canVerify={canVerifyRapidVision(user.role)}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-400">
          Select an active incident to open NexiQ Vision.
        </div>
      )}
    </div>
  );
}
