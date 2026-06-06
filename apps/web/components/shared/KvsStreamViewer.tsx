"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as KVSWebRTC from "amazon-kinesis-video-streams-webrtc";

interface ViewerToken {
  sessionId: string;
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
}

interface Props {
  sessionId: string;
  product: "connect" | "venue";
  incidentId: string;
  sourceLabel: string;
  onStreamEnd?: () => void;
  onError?: (error: string) => void;
}

type ConnectionState =
  | "IDLE"
  | "FETCHING_TOKEN"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "ERROR"
  | "ENDED";

export function KvsStreamViewer({
  sessionId,
  product,
  incidentId,
  sourceLabel,
  onStreamEnd,
  onError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<KVSWebRTC.SignalingClient | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const connectRef = useRef<() => Promise<void>>(async () => {});

  const [state, setState] = useState<ConnectionState>("IDLE");
  const [error, setError] = useState<string | null>(null);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    reconnectTimerRef.current = null;
    refreshTimerRef.current = null;
  }, []);

  const cleanupConnection = useCallback(() => {
    signalingRef.current?.close();
    signalingRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (endedRef.current) return;
    setState("RECONNECTING");
    reconnectTimerRef.current = setTimeout(() => {
      void connectRef.current();
    }, 3000);
  }, []);

  const fetchToken = useCallback(async (): Promise<ViewerToken> => {
    const res = await fetch("/api/stream/viewer-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, product }),
    });

    if (res.status === 409) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
      if (data.status === "BRIDGE_STARTING") throw new Error("BRIDGE_STARTING");
      throw new Error(data.error ?? "Session unavailable");
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return (await res.json()) as ViewerToken;
  }, [product, sessionId]);

  const connect = useCallback(async () => {
    clearTimers();
    cleanupConnection();
    setState("FETCHING_TOKEN");
    setError(null);

    let token: ViewerToken;
    try {
      token = await fetchToken();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Token fetch failed";
      if (message === "BRIDGE_STARTING") {
        setState("CONNECTING");
        reconnectTimerRef.current = setTimeout(() => {
          void connectRef.current();
        }, 3000);
        return;
      }
      setState("ERROR");
      setError(message);
      onError?.(message);
      return;
    }

    setState("CONNECTING");

    const peer = new RTCPeerConnection({
      iceServers: token.iceServers,
      iceTransportPolicy: "all",
    });
    peerRef.current = peer;

    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });
    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        setState("CONNECTED");
      }
    };
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "failed" || peer.iceConnectionState === "disconnected") {
        scheduleReconnect();
      }
    };

    const signalingClient = new KVSWebRTC.SignalingClient({
      channelARN: token.channelArn,
      channelEndpoint: token.wssEndpoint,
      role: KVSWebRTC.Role.VIEWER,
      region: token.region,
      credentials: {
        accessKeyId: token.credentials.accessKeyId,
        secretAccessKey: token.credentials.secretAccessKey,
        sessionToken: token.credentials.sessionToken,
      },
      clientId: `dispatcher-${sessionId.slice(0, 8)}`,
      requestSigner: new KVSWebRTC.SigV4RequestSigner(token.region, {
        accessKeyId: token.credentials.accessKeyId,
        secretAccessKey: token.credentials.secretAccessKey,
        sessionToken: token.credentials.sessionToken,
      }),
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
      if (!endedRef.current) scheduleReconnect();
    });
    signalingClient.on("error", () => {
      if (!endedRef.current) scheduleReconnect();
    });

    peer.addEventListener("icecandidate", ({ candidate }) => {
      if (candidate) signalingClient.sendIceCandidate(candidate);
    });

    signalingClient.open();

    const refreshMs = new Date(token.credentials.expiration).getTime() - Date.now() - 120_000;
    if (refreshMs > 0) {
      refreshTimerRef.current = setTimeout(() => {
        void connectRef.current();
      }, refreshMs);
    }
  }, [cleanupConnection, clearTimers, fetchToken, onError, scheduleReconnect, sessionId]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    endedRef.current = false;
    void connect();
    return () => {
      endedRef.current = true;
      setState("ENDED");
      clearTimers();
      cleanupConnection();
      onStreamEnd?.();
    };
  }, [cleanupConnection, clearTimers, connect, onStreamEnd]);

  const stateMessage = useMemo<Record<ConnectionState, string>>(
    () => ({
      IDLE: "Initializing...",
      FETCHING_TOKEN: "Authenticating...",
      CONNECTING: "Connecting to stream...",
      CONNECTED: "",
      RECONNECTING: "Reconnecting...",
      ERROR: error ?? "Connection error",
      ENDED: "Stream ended",
    }),
    [error],
  );

  return (
    <div className="relative overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16/9" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          state === "CONNECTED" ? "opacity-100" : "opacity-0"
        }`}
      />

      {state !== "CONNECTED" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950">
          {(state === "FETCHING_TOKEN" || state === "CONNECTING" || state === "RECONNECTING") && (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          )}
          <span className="text-sm text-zinc-400">{stateMessage[state]}</span>
          {state === "ERROR" && (
            <button
              type="button"
              onClick={() => void connect()}
              className="text-xs text-blue-400 transition-colors hover:text-blue-300"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {state === "CONNECTED" && (
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-medium text-white">LIVE</span>
            <span className="text-xs text-zinc-300">{sourceLabel}</span>
          </div>
          <span className="font-mono text-xs text-zinc-400">#{incidentId.slice(-6)}</span>
        </div>
      )}
    </div>
  );
}
