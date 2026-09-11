"use client";

/**
 * KVS WebRTC viewer for Rapid Vision™ sessions.
 *
 * Venue KVSWebRTCPlayer hard-codes /api/{vertical}/{agencyId}/cameras/viewer-token.
 * Vision sessions fetch GET /api/vision/sessions/{sessionId}/viewer-token instead.
 *
 * Tokens: surface #100e1a, border #1e1a30, text #e4dff5, muted #7c6fa0
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as KVSWebRTC from "amazon-kinesis-video-streams-webrtc";

type ViewerToken = {
  kvsChannelName: string;
  channelArn: string;
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: string;
  };
  wssEndpoint: string;
  iceServers: Array<{ urls: string[]; username?: string; credential?: string }>;
};

type ConnectionState = "idle" | "fetching" | "connecting" | "live" | "reconnecting" | "ended" | "error";

const C = {
  surface: "#100e1a",
  border: "#1e1a30",
  text: "#e4dff5",
  muted: "#7c6fa0",
  live: "#22c55e",
} as const;

export function VisionStreamPlayer({
  sessionId,
  incidentId,
  displayName,
  onLive,
  onClose,
}: {
  sessionId: string;
  incidentId: string;
  displayName: string;
  onLive?: () => void;
  onClose?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<KVSWebRTC.SignalingClient | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const connectRef = useRef<() => Promise<void>>(async () => {});
  const onLiveRef = useRef(onLive);
  onLiveRef.current = onLive;

  const [state, setState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    reconnectRef.current = null;
    signalingRef.current?.close();
    signalingRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
  }, []);

  const fetchToken = useCallback(async (): Promise<ViewerToken> => {
    const qs = new URLSearchParams({ incidentId });
    const res = await fetch(
      `/api/vision/sessions/${encodeURIComponent(sessionId)}/viewer-token?${qs}`,
      { credentials: "include" },
    );
    const body = (await res.json()) as {
      success?: boolean;
      data?: ViewerToken;
      error?: string;
    };
    if (!res.ok || !body.success || !body.data) {
      throw new Error(body.error ?? `Token fetch failed (${res.status})`);
    }
    return body.data;
  }, [sessionId, incidentId]);

  const connect = useCallback(async () => {
    cleanup();
    endedRef.current = false;
    setState("fetching");
    setError(null);

    let token: ViewerToken;
    try {
      token = await fetchToken();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Token fetch failed");
      return;
    }

    setState("connecting");

    const peer = new RTCPeerConnection({
      iceServers: token.iceServers,
      iceTransportPolicy: "all",
    });
    peerRef.current = peer;
    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });

    peer.ontrack = (ev) => {
      const stream = ev.streams[0];
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        setState("live");
        onLiveRef.current?.();
      }
    };

    peer.oniceconnectionstatechange = () => {
      if (
        (peer.iceConnectionState === "failed" || peer.iceConnectionState === "disconnected") &&
        !endedRef.current
      ) {
        setState("reconnecting");
        reconnectRef.current = setTimeout(() => void connectRef.current(), 3000);
      }
    };

    const clientId = `rv-${sessionId.slice(-12)}`;
    const sig = new KVSWebRTC.SignalingClient({
      channelARN: token.channelArn,
      channelEndpoint: token.wssEndpoint,
      role: KVSWebRTC.Role.VIEWER,
      region: token.region,
      credentials: token.credentials,
      clientId,
      requestSigner: new KVSWebRTC.SigV4RequestSigner(token.region, token.credentials),
    });
    signalingRef.current = sig;

    sig.on("open", async () => {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sig.sendSdpOffer(peer.localDescription!);
    });
    sig.on("sdpAnswer", async (ans) => {
      await peer.setRemoteDescription(ans);
    });
    sig.on("iceCandidate", async (cand) => {
      await peer.addIceCandidate(cand);
    });
    sig.on("close", () => {
      if (!endedRef.current) {
        setState("reconnecting");
        reconnectRef.current = setTimeout(() => void connectRef.current(), 3000);
      }
    });

    peer.addEventListener("icecandidate", ({ candidate }) => {
      if (candidate) sig.sendIceCandidate(candidate);
    });

    sig.open();
  }, [cleanup, fetchToken, sessionId]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    void connect();
    return () => {
      endedRef.current = true;
      cleanup();
    };
  }, [connect, cleanup]);

  const statusLabel =
    state === "live"
      ? "Live"
      : state === "error"
        ? (error ?? "Connection error")
        : state === "reconnecting"
          ? "Reconnecting…"
          : "Connecting…";

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{displayName}</div>
          <div
            style={{
              fontSize: 10,
              color: state === "live" ? C.live : C.muted,
              fontWeight: state === "live" ? 700 : 400,
            }}
          >
            {state === "live" ? "● Live" : statusLabel}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 10,
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
      <div style={{ aspectRatio: "16/9", background: "#000", borderRadius: 6, overflow: "hidden" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </div>
  );
}
