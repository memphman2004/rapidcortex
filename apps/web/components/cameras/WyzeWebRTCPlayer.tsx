"use client";

import { useEffect, useRef, useState } from "react";
import { WYZE_TM } from "@/lib/brand-marks";
import { V } from "@/lib/theme/rc-theme-tokens";

type StreamInfo = {
  signalingUrl: string;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  authToken: string;
  clientId: string;
  error?: string;
};

/**
 * Wyze live viewer. The Lambda returns KVS signaling URL + ICE servers + auth token
 * after owner consent; the browser negotiates WebRTC locally.
 */
export function WyzeWebRTCPlayer({
  mac,
  incidentId,
  displayName,
  onClose,
}: {
  mac: string;
  incidentId: string;
  displayName: string;
  onClose?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setConnecting(true);
      setError(null);
      try {
        const res = await fetch("/api/cameras/providers/wyze/answer-stream", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ incidentId, mac }),
        });
        const data = (await res.json()) as StreamInfo;
        if (!res.ok || !data.signalingUrl) {
          throw new Error(data.error ?? `Stream negotiation failed (${res.status})`);
        }
        if (cancelled) return;

        const iceServers = data.iceServers.length
          ? data.iceServers.map((s) => ({
              urls: s.urls,
              username: s.username,
              credential: s.credential,
            }))
          : [{ urls: "stun:stun.l.google.com:19302" }];

        const pc = new RTCPeerConnection({ iceServers });
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

        const ws = new WebSocket(data.signalingUrl);
        wsRef.current = ws;
        const authToken = data.authToken;

        await new Promise<void>((resolve, reject) => {
          const t = window.setTimeout(() => reject(new Error("Signaling timeout")), 12_000);
          ws.onopen = () => {
            window.clearTimeout(t);
            resolve();
          };
          ws.onerror = () => {
            window.clearTimeout(t);
            reject(new Error("Signaling socket failed"));
          };
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(
          JSON.stringify({
            action: "SDP_OFFER",
            messagePayload: btoa(offer.sdp ?? ""),
            recipientClientId: data.clientId,
            ...(authToken ? { authToken } : {}),
          }),
        );

        ws.onmessage = async (evt) => {
          try {
            const msg = JSON.parse(String(evt.data)) as {
              messageType?: string;
              action?: string;
              messagePayload?: string;
            };
            const kind = msg.messageType ?? msg.action;
            const payload = msg.messagePayload ? atob(msg.messagePayload) : "";
            if (kind === "SDP_ANSWER" && payload) {
              await pc.setRemoteDescription({ type: "answer", sdp: payload });
              if (!cancelled) setConnecting(false);
            }
            if (kind === "ICE_CANDIDATE" && payload) {
              const cand = JSON.parse(payload) as RTCIceCandidateInit;
              await pc.addIceCandidate(cand);
            }
          } catch (err) {
            console.warn("[wyze-player] signaling message", err);
          }
        };
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : `Unable to start ${WYZE_TM} stream`);
          setConnecting(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [incidentId, mac]);

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
            {WYZE_TM}
          </span>
          <span className="text-xs font-medium" style={{ color: V.text }}>
            {displayName}
          </span>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="text-xs" style={{ color: V.muted }}>
            Close
          </button>
        ) : null}
      </div>
      <div className="relative aspect-video bg-black">
        {connecting ? (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Connecting…
          </p>
        ) : null}
        {error ? (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-red-300">
            {error}
          </p>
        ) : null}
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
      </div>
    </div>
  );
}
