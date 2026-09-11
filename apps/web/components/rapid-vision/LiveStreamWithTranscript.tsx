"use client";

/**
 * Dispatcher surface: live Vision WebRTC (60%) + scene transcript (40%).
 *
 * Parent (RapidVisionPanel) passes latestWsEvent. Filter:
 *   type === "rapid-vision.transcript.segment" && segment.sessionId === sessionId
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { VisionWebSocketEvent } from "rapid-cortex-shared";
import { VisionStreamPlayer } from "./VisionStreamPlayer";
import { LiveTranscriptPanel, type TranscriptSegment } from "./LiveTranscriptPanel";

const C = {
  surface: "#100e1a",
  border: "#1e1a30",
  muted: "#7c6fa0",
  dim: "#3a3460",
  teal: "#06b6d4",
  live: "#22c55e",
} as const;

type TxStatus = "idle" | "starting" | "active" | "stopped";

interface Props {
  sessionId: string;
  incidentId: string;
  agencyId: string;
  cameraName: string;
  latestWsEvent?: VisionWebSocketEvent | null;
  autoStart?: boolean;
  onClose?: () => void;
}

export function LiveStreamWithTranscript({
  sessionId,
  incidentId,
  cameraName,
  latestWsEvent,
  autoStart = false,
  onClose,
}: Props) {
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [videoLive, setVideoLive] = useState(false);
  const autoFiredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const qs = new URLSearchParams({ sessionId, limit: "100" });
        const res = await fetch(
          `/api/incidents/${encodeURIComponent(incidentId)}/vision/transcript?${qs}`,
          { credentials: "include" },
        );
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          success: boolean;
          data: { segments: TranscriptSegment[] };
        };
        if (body.success && !cancelled) {
          setSegments(body.data.segments);
          if (body.data.segments.length > 0) setTxStatus("active");
        }
      } catch {
        /* empty transcript is non-fatal */
      } finally {
        if (!cancelled) setLoadingTx(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [incidentId, sessionId]);

  useEffect(() => {
    if (!latestWsEvent) return;
    if (latestWsEvent.type !== "rapid-vision.transcript.segment") return;
    const seg = latestWsEvent.segment;
    if (seg.sessionId !== sessionId) return;
    setSegments((prev) => {
      const idx = prev.findIndex((s) => s.resultId === seg.resultId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = seg;
        return next;
      }
      return [...prev, seg].slice(-300);
    });
    setTxStatus((status) => (status === "active" ? status : "active"));
  }, [latestWsEvent, sessionId]);

  const handleStart = useCallback(async () => {
    setTxStatus("starting");
    try {
      const res = await fetch(
        `/api/vision/sessions/${encodeURIComponent(sessionId)}/transcript/start`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ incidentId }),
        },
      );
      const body = (await res.json()) as { success?: boolean };
      setTxStatus(body.success ? "active" : "idle");
    } catch {
      setTxStatus("idle");
    }
  }, [sessionId, incidentId]);

  const handleStop = useCallback(async () => {
    try {
      await fetch(`/api/vision/sessions/${encodeURIComponent(sessionId)}/transcript/stop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ incidentId }),
      });
    } catch {
      /* best effort */
    }
    setTxStatus("stopped");
  }, [sessionId, incidentId]);

  const handleVideoLive = useCallback(() => {
    setVideoLive(true);
    if (autoStart && !autoFiredRef.current && txStatus === "idle") {
      autoFiredRef.current = true;
      void handleStart();
    }
  }, [autoStart, txStatus, handleStart]);

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          padding: "9px 14px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none" aria-hidden>
            <path
              d="M1 5.5c1.5-3.5 3-5 5.5-5s4 1.5 5.5 5c-1.5 3.5-3 5-5.5 5s-4-1.5-5.5-5z"
              stroke={C.teal}
              strokeWidth="1.4"
              fill="none"
            />
            <circle cx="6.5" cy="5.5" r="2.5" stroke={C.teal} strokeWidth="1.4" />
          </svg>
          <svg width="11" height="13" viewBox="0 0 11 13" fill="none" aria-hidden>
            <rect
              x="3"
              y="1"
              width="5"
              height="7"
              rx="2.5"
              stroke={txStatus === "active" ? C.live : C.muted}
              strokeWidth="1.3"
            />
            <path
              d="M1 7c0 2.5 9 2.5 9 0"
              stroke={txStatus === "active" ? C.live : C.muted}
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: "0.05em" }}>
            RAPID VISION™
          </div>
          <div style={{ fontSize: 9, color: C.muted }}>{cameraName} — Live + Transcript</div>
        </div>
        <div style={{ flex: 1 }} />
        {videoLive ? (
          <span style={{ fontSize: 9, fontWeight: 700, color: C.live, letterSpacing: "0.04em" }}>
            ● VIDEO LIVE
          </span>
        ) : null}
        {txStatus === "active" ? (
          <span style={{ fontSize: 9, fontWeight: 700, color: C.live, letterSpacing: "0.04em" }}>
            ● TX LIVE
          </span>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 11,
              color: C.muted,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60% 40%",
          flex: 1,
          minHeight: 320,
        }}
      >
        <div style={{ borderRight: `1px solid ${C.border}` }}>
          <VisionStreamPlayer
            sessionId={sessionId}
            incidentId={incidentId}
            displayName={cameraName}
            onLive={handleVideoLive}
          />
          <div
            style={{
              padding: "5px 10px",
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 9, color: C.muted }}>Session {sessionId.slice(-8)}</span>
            <span style={{ fontSize: 9, color: C.dim }}>·</span>
            <span style={{ fontSize: 9, color: C.muted }}>{incidentId}</span>
          </div>
        </div>
        <LiveTranscriptPanel
          incidentId={incidentId}
          sessionId={sessionId}
          cameraName={cameraName}
          initialSegments={segments}
          transcriptStatus={txStatus}
          loading={loadingTx}
          onStart={handleStart}
          onStop={handleStop}
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
}
