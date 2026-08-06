"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VenueIncidentCameraSummary } from "rapid-cortex-shared";
import { KVSWebRTCPlayer } from "./KVSWebRTCPlayer";
import {
  fetchVenueIncidentUpdates,
  fetchVenueSectionCameras,
  patchVenueIncidentStatus,
  postVenueCameraPtz,
  postVenueIncidentUpdate,
  type CameraApiVertical,
  type VenueIncidentUpdateRow,
} from "@/lib/venue/venue-camera-api";

export type VenueActiveIncidentPanel = {
  incidentId: string;
  section: string;
  reportType: string;
  location: string;
  cameras: VenueIncidentCameraSummary[];
  createdAt?: string;
};


function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function IncidentCameraPanel({
  agencyId,
  incident,
  canDispatch,
  onClose,
  onCameraOffline,
  embedded = false,
  mode = "new",
  apiVertical = "venue",
  locationNoun = "Section",
  enableDispatchControls = true,
}: {
  agencyId: string;
  incident: VenueActiveIncidentPanel;
  canDispatch: boolean;
  onClose?: () => void;
  onCameraOffline?: (cameraId: string, section: string) => void;
  /** When true, renders inline on the incident detail page instead of a modal overlay. */
  embedded?: boolean;
  mode?: "new" | "detail";
  apiVertical?: CameraApiVertical;
  /** UI label for location key (Section vs Building). */
  locationNoun?: string;
  /** When false, hides venue incident update/status APIs (campus uses campus incident APIs). */
  enableDispatchControls?: boolean;
}) {
  const [streamCameras, setStreamCameras] = useState<VenueIncidentCameraSummary[]>(incident.cameras);
  const [sectionCameras, setSectionCameras] = useState<VenueIncidentCameraSummary[]>([]);
  const [showAllSection, setShowAllSection] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [updates, setUpdates] = useState<VenueIncidentUpdateRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [ptzCameraId, setPtzCameraId] = useState<string | null>(null);
  const showDispatch = canDispatch && enableDispatchControls;

  useEffect(() => {
    setStreamCameras(incident.cameras.slice(0, 2));
  }, [incident]);

  const loadSectionCameras = useCallback(async () => {
    try {
      const rows = await fetchVenueSectionCameras(agencyId, incident.section, 20, apiVertical);
      setSectionCameras(rows);
    } catch {
      setSectionCameras([]);
    }
  }, [agencyId, apiVertical, incident.section]);

  useEffect(() => {
    void loadSectionCameras();
  }, [loadSectionCameras]);

  useEffect(() => {
    if (!enableDispatchControls) {
      setUpdates([]);
      return;
    }
    void (async () => {
      try {
        const rows = await fetchVenueIncidentUpdates(incident.incidentId);
        setUpdates(rows);
      } catch {
        setUpdates([]);
      }
    })();
  }, [enableDispatchControls, incident.incidentId]);

  const displayedIds = useMemo(() => new Set(streamCameras.map((c) => c.cameraId)), [streamCameras]);

  const addCamera = (camera: VenueIncidentCameraSummary) => {
    if (displayedIds.has(camera.cameraId)) return;
    setStreamCameras((prev) => {
      if (prev.length >= 2) return [prev[0]!, camera];
      return [...prev, camera];
    });
    setPickerOpen(false);
  };

  const swapOfflineCamera = useCallback(
    async (offlineCameraId: string) => {
      onCameraOffline?.(offlineCameraId, incident.section);
      const remaining = sectionCameras.filter(
        (c) => c.cameraId !== offlineCameraId && !displayedIds.has(c.cameraId),
      );
      const next = remaining[0];
      if (!next) return;
      setStreamCameras((prev) => prev.map((c) => (c.cameraId === offlineCameraId ? next : c)));
    },
    [displayedIds, incident.section, onCameraOffline, sectionCameras],
  );

  const sendUpdate = async () => {
    const message = draft.trim();
    if (!message || !showDispatch) return;
    setSending(true);
    try {
      const row = await postVenueIncidentUpdate(incident.incidentId, message);
      setUpdates((prev) => [...prev, row]);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: "assigned" | "responding" | "resolved") => {
    if (!showDispatch) return;
    setStatusBusy(true);
    try {
      await patchVenueIncidentStatus(incident.incidentId, status);
    } finally {
      setStatusBusy(false);
    }
  };

  const runPtz = async (cameraId: string, action: string) => {
    try {
      await postVenueCameraPtz(agencyId, cameraId, action, apiVertical);
    } catch {
      /* surface via toast later */
    }
  };

  const panelBody = (
      <div
        style={{
          width: embedded ? "100%" : "min(1100px, 100%)",
          maxHeight: embedded ? undefined : "95vh",
          overflow: embedded ? "visible" : "auto",
          background: "var(--rc-surface)",
          border: `1px solid var(--rc-border)`,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid var(--rc-border)`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {mode === "new" ? (
            <span style={{ color: "var(--rc-red)", fontWeight: 800, fontSize: 12 }}>● NEW INCIDENT</span>
          ) : (
            <span style={{ color: "var(--rc-amber)", fontWeight: 800, fontSize: 12 }}>INCIDENT {incident.incidentId}</span>
          )}
          <span style={{ color: "var(--rc-text-primary)", fontWeight: 700, fontSize: 13 }}>
            {locationNoun} {incident.section} · {incident.reportType.toUpperCase()}
          </span>
          <span style={{ color: "var(--rc-text-secondary)", fontSize: 11 }}>{incident.location}</span>
          <div style={{ flex: 1 }} />
          {onClose ? (
            <button type="button" onClick={onClose} style={{ color: "var(--rc-text-secondary)", fontSize: 12 }}>
              {embedded ? "Back" : "Close panel"}
            </button>
          ) : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 12 }}>
          {streamCameras.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", color: "var(--rc-text-secondary)", fontSize: 12, padding: 12 }}>
              No online cameras registered for {locationNoun} {incident.section}.
            </div>
          ) : (
            streamCameras.map((cam) => (
              <div key={cam.cameraId}>
                <KVSWebRTCPlayer
                  agencyId={agencyId}
                  kvsChannelName={cam.kvsChannelName}
                  displayName={cam.displayName}
                  apiVertical={apiVertical}
                />
                {cam.ptzCapable && canDispatch ? (
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setPtzCameraId(ptzCameraId === cam.cameraId ? null : cam.cameraId)}
                      style={{ fontSize: 10, color: "var(--rc-amber)" }}
                    >
                      PTZ Controls {ptzCameraId === cam.cameraId ? "▲" : "▼"}
                    </button>
                    {ptzCameraId === cam.cameraId ? (
                      <>
                        {(["pan_left", "pan_right", "tilt_up", "tilt_down", "zoom_in", "zoom_out"] as const).map(
                          (action) => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => void runPtz(cam.cameraId, action)}
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                border: `1px solid var(--rc-border)`,
                                borderRadius: 4,
                                color: "var(--rc-text-primary)",
                              }}
                            >
                              {action.replace("_", " ")}
                            </button>
                          ),
                        )}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: "0 12px 12px",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            style={{ fontSize: 11, color: "var(--rc-amber)", fontWeight: 600 }}
          >
            + Add camera view
          </button>
          <button
            type="button"
            onClick={() => setShowAllSection((v) => !v)}
            style={{ fontSize: 11, color: "var(--rc-text-secondary)" }}
          >
            All cameras for {locationNoun} {incident.section} ({sectionCameras.length} total)
          </button>
        </div>

        {pickerOpen || showAllSection ? (
          <div style={{ padding: "0 12px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sectionCameras.map((cam) => (
              <button
                key={cam.cameraId}
                type="button"
                disabled={displayedIds.has(cam.cameraId)}
                onClick={() => addCamera(cam)}
                style={{
                  fontSize: 10,
                  padding: "6px 8px",
                  border: `1px solid var(--rc-border)`,
                  borderRadius: 6,
                  color: displayedIds.has(cam.cameraId) ? "var(--rc-text-secondary)" : "var(--rc-text-primary)",
                  opacity: displayedIds.has(cam.cameraId) ? 0.5 : 1,
                }}
              >
                {cam.displayName}
              </button>
            ))}
          </div>
        ) : null}

        <div style={{ borderTop: `1px solid var(--rc-border)`, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--rc-text-secondary)", marginBottom: 8 }}>
            {enableDispatchControls ? "DISPATCHER UPDATES" : "INCIDENT CONTEXT"}
          </div>
          <div style={{ maxHeight: 140, overflow: "auto", marginBottom: 10 }}>
            {updates.length === 0 ? (
              <p style={{ fontSize: 11, color: "var(--rc-text-secondary)", margin: 0 }}>
                Incident received · {locationNoun} {incident.section} · {incident.reportType}
              </p>
            ) : (
              updates.map((row) => (
                <div key={row.updateId} style={{ fontSize: 11, color: "var(--rc-text-primary)", marginBottom: 6 }}>
                  <span style={{ color: "var(--rc-text-secondary)" }}>{formatClock(row.createdAt)}</span> [{row.actorLabel}]{" "}
                  {row.message}
                </div>
              ))
            )}
          </div>

          {showDispatch ? (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type update here…"
                  style={{
                    flex: 1,
                    background: "var(--rc-surface-alt)",
                    border: `1px solid var(--rc-border)`,
                    borderRadius: 6,
                    padding: "8px 10px",
                    color: "var(--rc-text-primary)",
                    fontSize: 12,
                  }}
                />
                <button
                  type="button"
                  disabled={sending || !draft.trim()}
                  onClick={() => void sendUpdate()}
                  style={{
                    padding: "8px 12px",
                    background: "var(--rc-amber)",
                    color: "var(--rc-amber-dim)",
                    fontWeight: 700,
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  Send Update
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={() => void setStatus("assigned")}
                  style={statusBtnStyle}
                >
                  ✓ Mark En Route
                </button>
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={() => void setStatus("responding")}
                  style={statusBtnStyle}
                >
                  ✓ On Scene
                </button>
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={() => void setStatus("resolved")}
                  style={{ ...statusBtnStyle, borderColor: "var(--rc-red)", color: "var(--rc-red-light)" }}
                >
                  ✓ Resolved
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
  );

  if (embedded) {
    return <div style={{ padding: 14 }}>{panelBody}</div>;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(8,7,16,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {panelBody}
    </div>
  );
}

const statusBtnStyle = {
  fontSize: 11,
  padding: "6px 10px",
  border: "1px solid var(--rc-border)",
  borderRadius: 6,
  color: "var(--rc-text-primary)",
  background: "var(--rc-surface-alt)",
} as const;

// expose offline swap for parent websocket handler
IncidentCameraPanel.swapOffline = async function swapOffline(
  streamCameras: VenueIncidentCameraSummary[],
  sectionCameras: VenueIncidentCameraSummary[],
  offlineCameraId: string,
): Promise<VenueIncidentCameraSummary[]> {
  const next = sectionCameras.find(
    (c) => c.cameraId !== offlineCameraId && !streamCameras.some((s) => s.cameraId === c.cameraId),
  );
  if (!next) return streamCameras.filter((c) => c.cameraId !== offlineCameraId);
  return streamCameras.map((c) => (c.cameraId === offlineCameraId ? next : c));
};
