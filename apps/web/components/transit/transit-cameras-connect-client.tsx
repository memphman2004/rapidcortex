"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Camera, Link2 } from "lucide-react";
import { CameraProviderSetup } from "@/components/cameras/CameraProviderSetup";
import { NestCameraPanel } from "@/components/cameras/NestCameraPanel";
import { GOOGLE_NEST_TM, NEST_TM, RING_TM } from "@/lib/brand-marks";
import { isNestEnabled } from "@/lib/nest-feature-flags";
import { isTransitCamerasUiEnabled } from "@/lib/runtime-flags";
import { RingConnectButton, ViewAvailableRingCamerasButton, isRingEnabled } from "@/src/features/connect/ring";
import type { RingDevicesResponse, RingRole } from "@/src/features/connect/ring/ring-types";
import type { TransitIncident } from "rapid-cortex-shared";

async function fetchRingDevices(): Promise<RingDevicesResponse> {
  const res = await fetch("/api/integrations/ring/devices", { credentials: "include" });
  if (res.status === 404) {
    return { success: true, data: { devices: [] } };
  }
  return (await res.json()) as RingDevicesResponse;
}

/**
 * Transit station / roadside cameras — Ring™ + Nest™ Connect, mirrored from campus/venue.
 */
export function TransitCamerasConnectClient({
  agencyId,
  transitCode,
  userId,
  userRole,
}: {
  agencyId: string;
  transitCode: string;
  userId: string;
  userRole: string;
}) {
  const queryClient = useQueryClient();
  const ringEnabled = isRingEnabled();
  const nestEnabled = isNestEnabled();
  const camerasEnabled = isTransitCamerasUiEnabled();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    const status = qp.get("status");
    const nest = qp.get("nest");
    if (status === "success" || status === "connected" || nest === "connected") {
      void queryClient.invalidateQueries({ queryKey: ["ring-devices", transitCode] });
      qp.delete("status");
      qp.delete("nest");
      const next = `${window.location.pathname}${qp.toString() ? `?${qp.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, [queryClient, transitCode]);

  const devicesQuery = useQuery({
    queryKey: ["ring-devices", transitCode],
    enabled: camerasEnabled && ringEnabled,
    queryFn: fetchRingDevices,
    refetchInterval: 30_000,
  });

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
  const devices = devicesQuery.data?.data?.devices ?? [];

  if (!camerasEnabled) return null;
  if (!ringEnabled && !nestEnabled) {
    return (
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-6 text-sm text-slate-300">
        {RING_TM} / {NEST_TM} Connect is not enabled in this environment.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Community cameras</h2>
        <p className="mt-1 text-sm text-slate-400">
          Link {RING_TM} and {GOOGLE_NEST_TM} accounts for consent-based live video near stations and
          incidents. Facility / onboard RTSP cameras are registered above.
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
        {ringEnabled ? (
          <section className="space-y-3 rounded-lg border border-blue-500/30 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-blue-200">{RING_TM}</h2>
            <RingConnectButton
              agencyId={agencyId}
              userId={userId}
              onLinked={() =>
                void queryClient.invalidateQueries({ queryKey: ["ring-devices", transitCode] })
              }
            />
            <ViewAvailableRingCamerasButton
              incidentId={selectedIncidentId}
              incidentLatitude={selectedIncident?.lat ?? null}
              incidentLongitude={selectedIncident?.lng ?? null}
              userRole={userRole as RingRole}
            />
            {devices.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {devices.map((device) => (
                  <article
                    key={device.deviceId}
                    className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-100">{device.deviceName}</h3>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          device.isEnabledForConnect ? "bg-green-400" : "bg-slate-500"
                        }`}
                      />
                    </div>
                    <div className="mt-2 flex aspect-video flex-col items-center justify-center rounded-md border border-slate-700 bg-slate-800/70 text-center">
                      <Camera className="mb-1 h-5 w-5 text-sky-400" />
                      <p className="text-xs text-slate-300">{device.deviceType}</p>
                    </div>
                    <a
                      href={`/transit/${transitCode}/incidents`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-sky-200"
                    >
                      <Link2 className="h-3 w-3" />
                      Incidents
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No {RING_TM} devices linked yet. Connect an account above.
              </p>
            )}
          </section>
        ) : null}

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
      </div>
    </div>
  );
}
