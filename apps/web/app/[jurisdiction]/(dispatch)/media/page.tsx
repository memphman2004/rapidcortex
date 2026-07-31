"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IncidentContextMap } from "@/components/dispatch/incident-context-map";
import { LiveVideoPanel } from "@/components/dispatch/live-video-panel";
import { SilentTextPanel } from "@/components/dispatch/silent-text-panel";
import { VideoAssistPanel } from "@/components/dispatch/video-assist-panel";
import { NestCameraPanel } from "@/components/cameras/NestCameraPanel";
import { useSession } from "@/components/auth/session-context";
import { GOOGLE_NEST_TM, NEST_TM, RING_TM } from "@/lib/brand-marks";
import { loadIncidents } from "@/lib/queries";
import { isLiveVideoEnabled } from "@/lib/runtime-flags";
import { isNestEnabled } from "@/lib/nest-feature-flags";
import {
  RingConnectButton,
  ViewAvailableRingCamerasButton,
  isRingEnabled,
} from "@/src/features/connect/ring";
import type { RingRole } from "@/src/features/connect/ring/ring-types";

export default function MediaPage() {
  const { user } = useSession();
  const ringEnabled = isRingEnabled();
  const nestEnabled = isNestEnabled();
  const liveVideoEnabled = isLiveVideoEnabled();
  const mediaEnabled = ringEnabled || nestEnabled || liveVideoEnabled;

  const [showRing, setShowRing] = useState(ringEnabled);
  const [showNest, setShowNest] = useState(nestEnabled);
  const [showFacility, setShowFacility] = useState(!ringEnabled && !nestEnabled);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [nestPendingCount, setNestPendingCount] = useState(0);

  const incidentsQuery = useQuery({
    queryKey: ["incidents", "media-page"],
    queryFn: loadIncidents,
  });

  const incidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);

  useEffect(() => {
    if (!ringEnabled) setShowRing(false);
    else setShowRing((prev) => prev || (!showNest && !showFacility));
  }, [ringEnabled]); // eslint-disable-line react-hooks/exhaustive-deps -- sync enablement only

  useEffect(() => {
    if (!nestEnabled) setShowNest(false);
  }, [nestEnabled]);

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

  const providerCount = (showRing ? 1 : 0) + (showNest ? 1 : 0) + (showFacility ? 1 : 0);

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

      {selectedIncident?.callerLocationLat != null && selectedIncident?.callerLocationLng != null ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Incident location</p>
          <div className="mt-2">
            <IncidentContextMap
              latitude={selectedIncident.callerLocationLat}
              longitude={selectedIncident.callerLocationLng}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
          Select an incident with a known location to show the map and enable nearby camera search.
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-200">
              Caller Video
            </span>
            <span className="text-xs text-slate-400">WebRTC · consent required</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <VideoAssistPanel incidentId={selectedIncidentId} ani={selectedIncident?.callerCallback} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-200">
              Live Camera
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 rounded border border-slate-700 bg-slate-800 p-0.5">
              {ringEnabled ? (
                <button
                  type="button"
                  aria-pressed={showRing}
                  onClick={() => setShowRing((v) => !v)}
                  className={`h-6 rounded px-2 text-xs ${
                    showRing ? "bg-blue-600/80 text-white" : "text-slate-300 hover:text-white"
                  }`}
                >
                  {RING_TM}
                </button>
              ) : null}
              {nestEnabled ? (
                <button
                  type="button"
                  aria-pressed={showNest}
                  onClick={() => setShowNest((v) => !v)}
                  className={`h-6 rounded px-2 text-xs ${
                    showNest ? "bg-emerald-600/80 text-white" : "text-slate-300 hover:text-white"
                  }`}
                >
                  {NEST_TM}
                  {nestPendingCount > 0 ? ` (${nestPendingCount})` : ""}
                </button>
              ) : null}
              <button
                type="button"
                aria-pressed={showFacility}
                onClick={() => setShowFacility((v) => !v)}
                className={`h-6 rounded px-2 text-xs ${
                  showFacility ? "bg-amber-600/80 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                Facility
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {providerCount === 0 ? (
              <p className="text-sm text-slate-400">
                Select {RING_TM}, {NEST_TM}, and/or Facility above to view camera workflows side by side.
              </p>
            ) : (
              <div
                className={`grid gap-4 ${
                  providerCount > 1 ? "xl:grid-cols-2" : "grid-cols-1"
                }`}
              >
                {showRing && ringEnabled ? (
                  <section className="space-y-3 rounded-lg border border-blue-500/30 bg-slate-950/40 p-3">
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-blue-300">
                      {RING_TM}
                    </h3>
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
                      <p className="text-sm text-slate-300">
                        Sign in to manage {RING_TM} camera workflows.
                      </p>
                    )}
                  </section>
                ) : null}

                {showNest && nestEnabled ? (
                  <section className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-950/40 p-3">
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                      {GOOGLE_NEST_TM}
                    </h3>
                    {user ? (
                      <NestCameraPanel
                        agencyId={user.agencyId}
                        incidentId={selectedIncidentId}
                        incidentLat={selectedIncident?.callerLocationLat}
                        incidentLng={selectedIncident?.callerLocationLng}
                        onPendingCountChange={setNestPendingCount}
                        connectSettingsHref="/admin/integrations"
                      />
                    ) : (
                      <p className="text-sm text-slate-300">
                        Sign in to manage {NEST_TM} camera workflows.
                      </p>
                    )}
                  </section>
                ) : null}

                {showFacility ? (
                  <section
                    className={`space-y-3 rounded-lg border border-amber-500/30 bg-slate-950/40 p-3 ${
                      providerCount > 2 ? "xl:col-span-2" : ""
                    }`}
                  >
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                      Facility
                    </h3>
                    <LiveVideoPanel
                      incidentId={selectedIncidentId}
                      ani={selectedIncident?.callerCallback}
                    />
                  </section>
                ) : null}
              </div>
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
          <SilentTextPanel
            incidentId={selectedIncidentId}
            callerLanguage={selectedIncident?.callerLanguage}
            ani={selectedIncident?.callerCallback}
          />
        </div>
      </div>
    </div>
  );
}
