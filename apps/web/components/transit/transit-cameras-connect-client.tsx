"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CameraProviderSetup } from "@/components/cameras/CameraProviderSetup";
import { NestCameraPanel } from "@/components/cameras/NestCameraPanel";
import { WyzeCameraPanel } from "@/components/cameras/WyzeCameraPanel";
import { GOOGLE_NEST_TM, WYZE_TM, joinTrademarkList } from "@/lib/brand-marks";
import { isNestEnabled } from "@/lib/nest-feature-flags";
import { isWyzeEnabled } from "@/lib/wyze-feature-flags";
import { isTransitCamerasUiEnabled } from "@/lib/runtime-flags";
import type { TransitIncident } from "rapid-cortex-shared";

/**
 * Transit station / roadside cameras — Nest™ + Wyze™ Connect, mirrored from campus/venue.
 */
export function TransitCamerasConnectClient({
  agencyId,
  transitCode,
}: {
  agencyId: string;
  transitCode: string;
}) {
  const nestEnabled = isNestEnabled();
  const wyzeEnabled = isWyzeEnabled();
  const camerasEnabled = isTransitCamerasUiEnabled();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    const status = qp.get("status");
    const nest = qp.get("nest");
    if (status === "success" || status === "connected" || nest === "connected") {
      qp.delete("status");
      qp.delete("nest");
      const next = `${window.location.pathname}${qp.toString() ? `?${qp.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  const incidentsQuery = useQuery({
    queryKey: ["transit-incidents-for-cameras", agencyId],
    enabled: camerasEnabled,
    queryFn: async () => {
      const res = await fetch(`/api/transit/${encodeURIComponent(agencyId)}/incidents`, {
        credentials: "include",
      });
      if (!res.ok) return [] as TransitIncident[];
      const json = (await res.json()) as { incidents?: TransitIncident[] };
      return json.incidents ?? [];
    },
  });

  const incidents = incidentsQuery.data ?? [];
  useEffect(() => {
    if (!incidents.length) {
      setSelectedIncidentId(null);
      return;
    }
    if (selectedIncidentId && incidents.some((i) => i.incidentId === selectedIncidentId)) return;
    setSelectedIncidentId(incidents[0]!.incidentId);
  }, [incidents, selectedIncidentId]);

  const selectedIncident = incidents.find((i) => i.incidentId === selectedIncidentId) ?? null;

  if (!camerasEnabled) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Community cameras</h2>
        <p className="mt-1 text-sm text-slate-400">
          Link {joinTrademarkList([nestEnabled && GOOGLE_NEST_TM, wyzeEnabled && WYZE_TM])}{" "}
          accounts for consent-based live video near stations and incidents. Facility / onboard RTSP
          cameras are registered above.
        </p>
      </div>

      <label className="block max-w-md text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Active incident (for nearby camera search)
        <select
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
          value={selectedIncidentId ?? ""}
          onChange={(e) => setSelectedIncidentId(e.target.value || null)}
        >
          {incidents.length === 0 ? (
            <option value="">No open incidents</option>
          ) : (
            incidents.map((incident) => (
              <option key={incident.incidentId} value={incident.incidentId}>
                {incident.type} · {incident.summary}
              </option>
            ))
          )}
        </select>
      </label>

      <div className="grid gap-6 xl:grid-cols-2">
        {nestEnabled ? (
          <section className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-emerald-200">{GOOGLE_NEST_TM}</h2>
            <CameraProviderSetup />
            <NestCameraPanel
              agencyId={agencyId}
              incidentId={selectedIncidentId}
              incidentLat={selectedIncident?.lat}
              incidentLng={selectedIncident?.lng}
              connectSettingsHref={`/transit/${transitCode}/cameras`}
            />
          </section>
        ) : null}

        {wyzeEnabled ? (
          <section className="space-y-3 rounded-lg border border-cyan-500/30 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-cyan-200">{WYZE_TM}</h2>
            <WyzeCameraPanel
              agencyId={agencyId}
              incidentId={selectedIncidentId}
              incidentLat={selectedIncident?.lat}
              incidentLng={selectedIncident?.lng}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
