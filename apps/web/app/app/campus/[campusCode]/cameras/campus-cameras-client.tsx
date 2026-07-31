"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Camera, Link2 } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { CameraProviderSetup } from "@/components/cameras/CameraProviderSetup";
import { NestCameraPanel } from "@/components/cameras/NestCameraPanel";
import { GOOGLE_NEST_TM, NEST_TM, RING_TM } from "@/lib/brand-marks";
import { isNestEnabled } from "@/lib/nest-feature-flags";
import { RingConnectButton, ViewAvailableRingCamerasButton, isRingEnabled } from "@/src/features/connect/ring";
import type { RingDevicesResponse, RingRole } from "@/src/features/connect/ring/ring-types";

async function fetchRingDevices(): Promise<RingDevicesResponse> {
  const res = await fetch("/api/integrations/ring/devices", { credentials: "include" });
  if (res.status === 404) {
    return { success: true, data: { devices: [] } };
  }
  return (await res.json()) as RingDevicesResponse;
}

/**
 * Campus dorm / residential cameras — Ring™ + Nest™ Connect for student-owned doorbells
 * and agency Nest™ accounts, mirrored from venue cameras UX.
 */
export function CampusCamerasClient({ campusCode }: { campusCode: string }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const ringEnabled = isRingEnabled();
  const nestEnabled = isNestEnabled();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    const status = qp.get("status");
    const nest = qp.get("nest");
    if (status === "success" || status === "connected" || nest === "connected") {
      void queryClient.invalidateQueries({ queryKey: ["ring-devices", campusCode] });
      qp.delete("status");
      qp.delete("nest");
      const next = `${window.location.pathname}${qp.toString() ? `?${qp.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, [campusCode, queryClient]);

  const devicesQuery = useQuery({
    queryKey: ["ring-devices", campusCode],
    enabled: ringEnabled && Boolean(user),
    queryFn: fetchRingDevices,
    refetchInterval: 30_000,
  });

  const incidentsQuery = useQuery({
    queryKey: ["campus-incidents-for-cameras", campusCode],
    enabled: Boolean(user),
    queryFn: async () => {
      const res = await fetch(`/api/campus/incidents?limit=25`, { credentials: "include" });
      if (!res.ok) return [] as Array<{ incidentId: string; title?: string; callerLocationLat?: number; callerLocationLng?: number }>;
      const json = (await res.json()) as {
        incidents?: Array<{ incidentId: string; title?: string; callerLocationLat?: number; callerLocationLng?: number }>;
        data?: Array<{ incidentId: string; title?: string; callerLocationLat?: number; callerLocationLng?: number }>;
      };
      return json.incidents ?? json.data ?? [];
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

  if (!ringEnabled && !nestEnabled) {
    return (
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-6 text-sm text-slate-300">
        {RING_TM} / {NEST_TM} Connect is not enabled in this environment.
      </div>
    );
  }

  if (!user) {
    return <p className="text-sm text-slate-400">Sign in to manage campus cameras.</p>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cameras</h1>
        <p className="mt-1 text-sm text-slate-400">
          Link dorm {RING_TM} and {GOOGLE_NEST_TM} cameras for consent-based live video during campus
          incidents. Agency-owned {NEST_TM} streams are available after admin OAuth.
        </p>
      </div>

      <label className="block max-w-md text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Active incident (for nearby dorm search)
        <select
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
          value={selectedIncidentId ?? ""}
          onChange={(e) => setSelectedIncidentId(e.target.value || null)}
        >
          {incidents.length === 0 ? (
            <option value="">No open incidents</option>
          ) : (
            incidents.map((i) => (
              <option key={i.incidentId} value={i.incidentId}>
                {i.incidentId}
                {i.title ? ` · ${i.title}` : ""}
              </option>
            ))
          )}
        </select>
      </label>

      <div className="grid gap-6 xl:grid-cols-2">
        {ringEnabled ? (
          <section className="space-y-3 rounded-lg border border-blue-500/30 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-blue-200">{RING_TM} dorm cameras</h2>
            <RingConnectButton
              agencyId={user.agencyId}
              userId={user.userId}
              onLinked={() =>
                void queryClient.invalidateQueries({ queryKey: ["ring-devices", campusCode] })
              }
            />
            <ViewAvailableRingCamerasButton
              incidentId={selectedIncidentId}
              incidentLatitude={selectedIncident?.callerLocationLat ?? null}
              incidentLongitude={selectedIncident?.callerLocationLng ?? null}
              userRole={user.role as RingRole}
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
                      href={`/app/campus/${campusCode}/incidents`}
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
                No {RING_TM} devices linked yet. Connect a dorm account above.
              </p>
            )}
          </section>
        ) : null}

        {nestEnabled ? (
          <section className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-emerald-200">{GOOGLE_NEST_TM} dorm cameras</h2>
            <CameraProviderSetup />
            <NestCameraPanel
              agencyId={user.agencyId}
              incidentId={selectedIncidentId}
              incidentLat={selectedIncident?.callerLocationLat}
              incidentLng={selectedIncident?.callerLocationLng}
              connectSettingsHref={`/app/campus/${campusCode}/cameras`}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
