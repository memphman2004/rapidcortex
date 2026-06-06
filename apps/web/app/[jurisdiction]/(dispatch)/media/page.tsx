"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { LiveVideoPanel } from "@/components/dispatch/live-video-panel";
import { SilentTextPanel } from "@/components/dispatch/silent-text-panel";
import { VideoAssistPanel } from "@/components/dispatch/video-assist-panel";
import { useSession } from "@/components/auth/session-context";
import { loadIncidents } from "@/lib/queries";
import { isLiveVideoEnabled } from "@/lib/runtime-flags";
import {
  RingConnectButton,
  ViewAvailableRingCamerasButton,
  isRingEnabled,
} from "@/src/features/connect/ring";
import type { RingRole } from "@/src/features/connect/ring/ring-types";

export default function MediaPage() {
  const { user } = useSession();
  const ringEnabled = isRingEnabled();
  const liveVideoEnabled = isLiveVideoEnabled();
  const mediaEnabled = ringEnabled || liveVideoEnabled;
  const defaultCameraTab: "ring" | "connect" = ringEnabled ? "ring" : "connect";
  const [cameraTab, setCameraTab] = useState<"ring" | "connect">(defaultCameraTab);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const incidentsQuery = useQuery({
    queryKey: ["incidents", "media-page"],
    queryFn: loadIncidents,
  });

  const incidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);

  useEffect(() => {
    if (!ringEnabled && cameraTab === "ring") {
      setCameraTab("connect");
    }
  }, [cameraTab, ringEnabled]);

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

  if (!mediaEnabled) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
          Media workflows are currently disabled for this environment.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">
          Incident Context
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-200">
              Caller Video
            </span>
            <span className="text-xs text-slate-400">WebRTC · consent required</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <VideoAssistPanel incidentId={selectedIncidentId} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-200">
              Live Camera
            </span>
            <div className="inline-flex items-center rounded border border-slate-700 bg-slate-800 p-0.5">
              {ringEnabled ? (
                <button
                  type="button"
                  onClick={() => setCameraTab("ring")}
                  className={`h-6 rounded px-2 text-xs ${
                    cameraTab === "ring" ? "bg-slate-700 text-white" : "text-slate-300 hover:text-white"
                  }`}
                >
                  Ring
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setCameraTab("connect")}
                className={`h-6 rounded px-2 text-xs ${
                  cameraTab === "connect" ? "bg-slate-700 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                Facility
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {cameraTab === "ring" && ringEnabled ? (
              <div className="space-y-3">
                {user ? (
                  <>
                    <RingConnectButton agencyId={user.agencyId} userId={user.userId} />
                    <ViewAvailableRingCamerasButton
                      incidentId={selectedIncidentId}
                      incidentLatitude={selectedIncident?.callerLocationLat ?? null}
                      incidentLongitude={selectedIncident?.callerLocationLng ?? null}
                      userRole={user.role as RingRole}
                    />
                  </>
                ) : (
                  <p className="text-sm text-slate-300">Sign in to manage Ring camera workflows.</p>
                )}
              </div>
            ) : (
              <LiveVideoPanel incidentId={selectedIncidentId} />
            )}
          </div>
        </div>
      </div>

      <div className="flex h-64 min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-200">
            Text to Caller
          </span>
          <span className="text-xs text-slate-400">Silent Text · consent required</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <SilentTextPanel incidentId={selectedIncidentId} />
        </div>
      </div>
    </div>
  );
}
