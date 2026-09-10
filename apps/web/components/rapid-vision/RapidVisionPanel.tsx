"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  VisionCameraSearchResult,
  VisionIntelligenceFeed,
  VisionObservation,
  VisionSession,
  VisionWebSocketEvent,
} from "rapid-cortex-shared";
import { useAgencyWebSocket, type AgencyWebSocketMessage } from "@/hooks/use-agency-websocket";
import { VisionIntelligenceFeed as FeedComponent } from "./VisionIntelligenceFeed";
import type { StreamingObservationEntry } from "./VisionIntelligenceFeed";
import { VisionCameraList } from "./VisionCameraList";

const V = {
  bg: "#09080f",
  surface: "#0f0d1a",
  surfaceRaised: "#141122",
  border: "#1a1630",
  borderActive: "#1e3a5f",
  vision: "#06b6d4",
  visionDim: "#0e7490",
  visionGlow: "#06b6d420",
  verified: "#22c55e",
  unverified: "#f59e0b",
  rejected: "#6b7280",
  alert: "#ef4444",
  text: "#e4dff5",
  muted: "#6b6190",
  dim: "#3a3460",
} as const;

type PanelTab = "intelligence" | "cameras" | "live" | "verified";

interface Props {
  incidentId: string;
  incidentLat: number;
  incidentLng: number;
  canVerify: boolean;
}

function asVisionEvent(message: AgencyWebSocketMessage): VisionWebSocketEvent | null {
  if (!message.type.startsWith("rapid-vision.")) return null;
  return { type: message.type, ...(message.data ?? {}) } as VisionWebSocketEvent;
}

export function RapidVisionPanel({
  incidentId,
  incidentLat,
  incidentLng,
  canVerify,
}: Props) {
  const [tab, setTab] = useState<PanelTab>("intelligence");
  const [feed, setFeed] = useState<VisionIntelligenceFeed | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [newObsCount, setNewObsCount] = useState(0);
  const [streamingObs, setStreamingObs] = useState<Map<string, StreamingObservationEntry>>(
    new Map(),
  );

  const loadFeed = useCallback(async () => {
    try {
      const [intelRes, searchRes] = await Promise.all([
        fetch(`/api/incidents/${encodeURIComponent(incidentId)}/vision/intelligence`, {
          credentials: "include",
        }),
        fetch(`/api/incidents/${encodeURIComponent(incidentId)}/vision/cameras/search`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ radiusMeters: 500 }),
        }),
      ]);
      const intelBody = intelRes.ok
        ? ((await intelRes.json()) as { success: boolean; data: VisionIntelligenceFeed })
        : null;
      const searchBody = searchRes.ok
        ? ((await searchRes.json()) as {
            success: boolean;
            data: { cameras: VisionCameraSearchResult[] };
          })
        : null;
      if (intelBody?.success) {
        setFeed({
          ...intelBody.data,
          discoveredCameras: searchBody?.success ? searchBody.data.cameras : [],
        });
      }
    } catch {
      /* empty state */
    } finally {
      setLoadingFeed(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const onWs = useCallback(
    (message: AgencyWebSocketMessage) => {
      const event = asVisionEvent(message);
      if (!event) return;
      if (event.type === "rapid-vision.observation.streaming.start") {
        if (event.incidentId !== incidentId) return;
        setStreamingObs((prev) => {
          const next = new Map(prev);
          next.set(event.observationId, {
            cameraName: event.cameraName,
            text: "",
            timestamp: event.timestamp,
          });
          return next;
        });
        return;
      }
      if (event.type === "rapid-vision.observation.streaming.token") {
        if (event.incidentId !== incidentId) return;
        setStreamingObs((prev) => {
          const entry = prev.get(event.observationId);
          if (!entry) return prev;
          const next = new Map(prev);
          next.set(event.observationId, { ...entry, text: entry.text + event.token });
          return next;
        });
        return;
      }
      if (event.type === "rapid-vision.observation.streaming.complete") {
        if (event.incidentId !== incidentId) return;
        setStreamingObs((prev) => {
          const next = new Map(prev);
          next.delete(event.observationId);
          return next;
        });
        setFeed((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            observations: [event.observation, ...prev.observations].slice(0, 100),
            unverifiedCount: prev.unverifiedCount + 1,
            lastUpdated: new Date().toISOString(),
          };
        });
        if (tab !== "intelligence") setNewObsCount((n) => n + 1);
        return;
      }
      if (event.type === "rapid-vision.observation.streaming.abort") {
        if (event.incidentId && event.incidentId !== incidentId) return;
        setStreamingObs((prev) => {
          const next = new Map(prev);
          next.delete(event.observationId);
          return next;
        });
        return;
      }
      if (event.type === "rapid-vision.observation.created") {
        if (event.observation.incidentId !== incidentId) return;
        setFeed((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            observations: [event.observation, ...prev.observations].slice(0, 100),
            unverifiedCount: prev.unverifiedCount + 1,
            lastUpdated: new Date().toISOString(),
          };
        });
        if (tab !== "intelligence") setNewObsCount((n) => n + 1);
      } else if (
        event.type === "rapid-vision.observation.verified" ||
        event.type === "rapid-vision.observation.rejected"
      ) {
        const status =
          event.type === "rapid-vision.observation.verified" ? "verified" : "rejected";
        setFeed((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            observations: prev.observations.map((o) =>
              o.observationId === event.observationId ? { ...o, verificationStatus: status } : o,
            ),
          };
        });
      }
    },
    [incidentId, tab],
  );

  const { connected: wsConnected } = useAgencyWebSocket(onWs, { enabled: true });

  const switchTab = (t: PanelTab) => {
    setTab(t);
    if (t === "intelligence") setNewObsCount(0);
  };

  const postObservation = async (observationId: string, action: "verify" | "reject" | "add-to-incident") => {
    await fetch(`/api/vision/observations/${encodeURIComponent(observationId)}/${action}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ incidentId }),
    });
    await loadFeed();
  };

  const handleRequestAccess = async (cameraId: string, durationMinutes: number) => {
    await fetch(
      `/api/incidents/${encodeURIComponent(incidentId)}/vision/cameras/${encodeURIComponent(cameraId)}/request-access`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ durationMinutes }),
      },
    );
    await loadFeed();
  };

  const activeSessions = feed?.activeSessions ?? [];
  const observations = feed?.observations ?? [];
  const cameras = feed?.discoveredCameras ?? [];
  const unverifiedCount = feed?.unverifiedCount ?? 0;
  const verifiedCount = feed?.verifiedCount ?? 0;

  return (
    <div
      style={{
        background: V.bg,
        border: `1px solid ${V.border}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 420,
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "10px 14px 0", borderBottom: `1px solid ${V.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: V.visionGlow,
              border: `1px solid ${V.visionDim}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="3" stroke={V.vision} strokeWidth="1.5" />
              <path
                d="M1 7c1.5-3.5 4-5 6-5s4.5 1.5 6 5c-1.5 3.5-4 5-6 5s-4.5-1.5-6-5z"
                stroke={V.vision}
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: V.vision, letterSpacing: "0.05em" }}>
              RAPID VISION™
            </div>
            <div style={{ fontSize: 9, color: V.muted, marginTop: 1 }}>
              AI-powered visual intelligence
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeSessions.length > 0 ? (
              <span
                style={{
                  fontSize: 9,
                  color: V.vision,
                  fontWeight: 700,
                  background: V.visionGlow,
                  padding: "2px 6px",
                  borderRadius: 4,
                  border: `1px solid ${V.visionDim}`,
                }}
              >
                {activeSessions.length} SESSION{activeSessions.length !== 1 ? "S" : ""} ACTIVE
              </span>
            ) : null}
            <span
              style={{
                fontSize: 9,
                color: wsConnected ? V.verified : V.muted,
                fontWeight: 600,
              }}
            >
              {wsConnected ? "● LIVE" : "○ CONNECTING"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          {(
            [
              { id: "intelligence" as const, label: "INTELLIGENCE", badge: newObsCount || undefined },
              {
                id: "cameras" as const,
                label: "CAMERAS",
                badge: cameras.filter((c) => c.accessState === "AVAILABLE").length || undefined,
              },
              { id: "live" as const, label: "LIVE", badge: activeSessions.length || undefined },
              { id: "verified" as const, label: "VERIFIED", badge: verifiedCount || undefined },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              style={{
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: tab === t.id ? V.vision : V.muted,
                background: "none",
                border: "none",
                borderBottom: tab === t.id ? `2px solid ${V.vision}` : "2px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 ? (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    color: "#fff",
                    background: t.id === "intelligence" ? V.unverified : V.vision,
                    borderRadius: 10,
                    padding: "1px 4px",
                    minWidth: 14,
                    textAlign: "center",
                  }}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "intelligence" ? (
          <FeedComponent
            observations={observations}
            streamingObs={streamingObs}
            loadingFeed={loadingFeed}
            unverifiedCount={unverifiedCount}
            canVerify={canVerify}
            onVerify={(id) => postObservation(id, "verify")}
            onReject={(id) => postObservation(id, "reject")}
            onAddToIncident={(id) => postObservation(id, "add-to-incident")}
            V={V}
          />
        ) : null}
        {tab === "cameras" ? (
          <VisionCameraList
            cameras={cameras}
            onRequestAccess={handleRequestAccess}
            onRefresh={loadFeed}
            V={V}
          />
        ) : null}
        {tab === "live" ? (
          <LiveStreamTab sessions={activeSessions} V={V} />
        ) : null}
        {tab === "verified" ? (
          <VerifiedTab
            observations={observations.filter((o) => o.verificationStatus === "verified")}
            V={V}
          />
        ) : null}
      </div>
      <span className="sr-only">
        Incident location {incidentLat.toFixed(4)}, {incidentLng.toFixed(4)}
      </span>
    </div>
  );
}

function LiveStreamTab({ sessions, V }: { sessions: VisionSession[]; V: typeof V }) {
  if (!sessions.length) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 8,
          padding: 24,
          color: V.muted,
        }}
      >
        <span style={{ fontSize: 12 }}>No active live sessions.</span>
        <span style={{ fontSize: 10 }}>Request camera access from the Cameras tab.</span>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
      <p style={{ fontSize: 10, color: V.muted, marginBottom: 12 }}>
        Use the Intelligence tab to read AI observations. Live feeds are for spot-check only.
      </p>
      {sessions.map((session) => (
        <div
          key={session.sessionId}
          style={{
            background: V.surfaceRaised,
            border: `1px solid ${V.border}`,
            borderRadius: 8,
            padding: 12,
            marginBottom: 8,
            fontSize: 11,
            color: V.text,
          }}
        >
          Session {session.sessionId.slice(-8)} · {session.status}
          {session.kvsChannelName ? " · stream connecting" : ""}
        </div>
      ))}
    </div>
  );
}

function VerifiedTab({ observations, V }: { observations: VisionObservation[]; V: typeof V }) {
  if (!observations.length) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: V.muted,
          fontSize: 12,
          padding: 24,
        }}
      >
        No verified observations yet.
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
      {observations.map((observation) => (
        <div
          key={observation.observationId}
          style={{
            padding: "8px 10px",
            marginBottom: 6,
            background: V.surfaceRaised,
            border: `1px solid ${V.border}`,
            borderLeft: `3px solid ${V.verified}`,
            borderRadius: 6,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: V.text, lineHeight: 1.5 }}>
            {observation.narrative}
          </p>
        </div>
      ))}
    </div>
  );
}
