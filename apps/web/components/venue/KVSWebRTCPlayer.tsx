"use client";

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
  iceServers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>;
};

type ConnectionState = "idle" | "fetching" | "connecting" | "live" | "reconnecting" | "ended" | "error";

/** KVS WebRTC viewer for venue/campus registry cameras (fixed channel name). */
export function KVSWebRTCPlayer({
  agencyId,
  kvsChannelName,
  displayName,
  onClose,
  apiVertical = "venue",
}: {
  agencyId: string;
  kvsChannelName: string;
  displayName: string;
  onClose?: () => void;
  apiVertical?: "venue" | "campus";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<KVSWebRTC.SignalingClient | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const connectRef = useRef<() => Promise<void>>(async () => {});

  const [state, setState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    signalingRef.current?.close();
    signalingRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
  }, []);

  const fetchToken = useCallback(async (): Promise<ViewerToken> => {
    const qs = new URLSearchParams({ kvsChannelName });
    const res = await fetch(
      `/api/${apiVertical}/${encodeURIComponent(agencyId)}/cameras/viewer-token?${qs}`,
      { credentials: "include" },
    );
    const body = (await res.json()) as ViewerToken & { error?: string };
    if (!res.ok) throw new Error(body.error ?? `Unable to load stream (${res.status})`);
    return body;
  }, [agencyId, apiVertical, kvsChannelName]);

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
    const peer = new RTCPeerConnection({ iceServers: token.iceServers, iceTransportPolicy: "all" });
    peerRef.current = peer;
    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });
    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        setState("live");
      }
    };
    peer.oniceconnectionstatechange = () => {
      if (
        (peer.iceConnectionState === "failed" || peer.iceConnectionState === "disconnected") &&
        !endedRef.current
      ) {
        setState("reconnecting");
        reconnectTimerRef.current = setTimeout(() => void connectRef.current(), 3000);
      }
    };

    const clientId = `venue-${kvsChannelName.slice(-12)}`;
    const signalingClient = new KVSWebRTC.SignalingClient({
      channelARN: token.channelArn,
      channelEndpoint: token.wssEndpoint,
      role: KVSWebRTC.Role.VIEWER,
      region: token.region,
      credentials: token.credentials,
      clientId,
      requestSigner: new KVSWebRTC.SigV4RequestSigner(token.region, token.credentials),
    });
    signalingRef.current = signalingClient;

    signalingClient.on("open", async () => {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      signalingClient.sendSdpOffer(peer.localDescription!);
    });
    signalingClient.on("sdpAnswer", async (answer) => {
      await peer.setRemoteDescription(answer);
    });
    signalingClient.on("iceCandidate", async (candidate) => {
      await peer.addIceCandidate(candidate);
    });
    signalingClient.on("close", () => {
      if (!endedRef.current) {
        setState("reconnecting");
        reconnectTimerRef.current = setTimeout(() => void connectRef.current(), 3000);
      }
    });

    peer.addEventListener("icecandidate", ({ candidate }) => {
      if (candidate) signalingClient.sendIceCandidate(candidate);
    });
    signalingClient.open();
  }, [cleanup, fetchToken, kvsChannelName]);

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
        ? error ?? "Connection error"
        : state === "reconnecting"
          ? "Reconnecting…"
          : "Connecting…";

  return (
    <div
      style={{
        background: "#141220",
        border: "1px solid #1e1a30",
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e4dff5" }}>{displayName}</div>
          <div style={{ fontSize: 10, color: "#7c6fa0" }}>{statusLabel}</div>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} style={{ fontSize: 10, color: "#7c6fa0" }}>
            ✕
          </button>
        ) : null}
      </div>
      <div style={{ aspectRatio: "16/9", background: "#000", borderRadius: 6, overflow: "hidden" }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
