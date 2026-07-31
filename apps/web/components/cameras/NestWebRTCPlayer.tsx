"use client";

import { useEffect, useRef, useState } from "react";
import { NEST_TM } from "@/lib/brand-marks";

const V = {
  surface: "#100e1a",
  border: "#1e1a30",
  text: "#e4dff5",
  muted: "#7c6fa0",
  green: "#10b981",
  red: "#ef4444",
};

/**
 * Nest SDM WebRTC player — browser creates the SDP offer; Nest returns the answer.
 * (Props `offerSdp`/`streamToken` from older designs are unused; session is negotiated live.)
 */
export function NestWebRTCPlayer({
  deviceId,
  agencyId,
  displayName,
  onClose,
}: {
  deviceId: string;
  agencyId: string;
  displayName: string;
  /** Optional legacy props ignored — negotiation is client-offer based. */
  streamToken?: string;
  offerSdp?: string;
  onClose?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mediaSessionIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setConnecting(true);
      setError(null);
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.ontrack = (ev) => {
          const el = videoRef.current;
          if (!el) return;
          if (el.srcObject !== ev.streams[0]) {
            el.srcObject = ev.streams[0] ?? null;
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait briefly for ICE gathering (Nest often accepts incomplete candidates).
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
            return;
          }
          const t = window.setTimeout(() => resolve(), 2500);
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") {
              window.clearTimeout(t);
              resolve();
            }
          };
        });

        const localSdp = pc.localDescription?.sdp;
        if (!localSdp) throw new Error("Failed to create local SDP offer");

        const res = await fetch("/api/cameras/providers/nest/answer-stream", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agencyId, deviceId, offerSdp: localSdp }),
        });
        const data = (await res.json()) as {
          answerSdp?: string;
          mediaSessionId?: string;
          error?: string;
        };
        if (!res.ok || !data.answerSdp) {
          throw new Error(data.error ?? `Stream negotiation failed (${res.status})`);
        }
        if (cancelled) return;
        mediaSessionIdRef.current = data.mediaSessionId ?? null;
        await pc.setRemoteDescription({ type: "answer", sdp: data.answerSdp });
        setConnecting(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : `Unable to start ${NEST_TM} stream`);
          setConnecting(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      const sessionId = mediaSessionIdRef.current;
      mediaSessionIdRef.current = null;
      const pc = pcRef.current;
      pcRef.current = null;
      pc?.close();
      if (sessionId) {
        void fetch("/api/cameras/providers/nest/stop-stream", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agencyId, deviceId, mediaSessionId: sessionId }),
        }).catch(() => undefined);
      }
    };
  }, [agencyId, deviceId]);

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ background: V.surface, borderColor: V.border }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: V.border }}
      >
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{ background: `${V.green}33`, color: V.green }}
          >
            {NEST_TM}
          </span>
          <span className="text-xs font-medium" style={{ color: V.text }}>
            {displayName}
          </span>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-xs"
            style={{ color: V.muted }}
          >
            Close
          </button>
        ) : null}
      </div>
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
        {connecting ? (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs"
            style={{ color: V.muted }}
          >
            Connecting to {NEST_TM}…
          </div>
        ) : null}
        {error ? (
          <div
            className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs"
            style={{ color: V.red }}
          >
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
