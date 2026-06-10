"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as KVSWebRTC from "amazon-kinesis-video-streams-webrtc";

type ViewerToken = {
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
};

type ConnectionState = "idle" | "fetching" | "connecting" | "live" | "reconnecting" | "ended" | "error";

export function KvsRingStreamViewer({
  sessionId,
  deviceName,
  onClose,
}: {
  sessionId: string;
  deviceName: string;
  onClose?: () => void;
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
    const res = await fetch(
      `/api/integrations/ring/stream/viewer-token?sessionId=${encodeURIComponent(sessionId)}`,
      { credentials: "include" },
    );
    const body = (await res.json()) as {
      success?: boolean;
      data?: ViewerToken;
      error?: string;
    };
    if (!res.ok || !body.success || !body.data) {
      throw new Error(body.error ?? `Unable to load stream (${res.status})`);
    }
    return body.data;
  }, [sessionId]);

  const connect = useCallback(async () => {
    cleanup();
    endedRef.current = false;
    setState("fetching");
    setError(null);

    let token: ViewerToken;
    try {
      token = await fetchToken();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Token fetch failed";
      if (message.toLowerCase().includes("retry")) {
        setState("connecting");
        reconnectTimerRef.current = setTimeout(() => {
          void connectRef.current();
        }, 3000);
        return;
      }
      setState("error");
      setError(message);
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
      if (peer.iceConnectionState === "failed" || peer.iceConnectionState === "disconnected") {
        if (!endedRef.current) {
          setState("reconnecting");
          reconnectTimerRef.current = setTimeout(() => {
            void connectRef.current();
          }, 3000);
        }
      }
      if (peer.iceConnectionState === "closed") {
        setState("ended");
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
      clientId: `ring-viewer-${sessionId.slice(0, 8)}`,
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
      if (!endedRef.current) {
        setState("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          void connectRef.current();
        }, 3000);
      }
    });
    signalingClient.on("error", () => {
      if (!endedRef.current) {
        setState("reconnecting");
        reconnectTimerRef.current = setTimeout(() => {
          void connectRef.current();
        }, 3000);
      }
    });

    peer.addEventListener("icecandidate", ({ candidate }) => {
      if (candidate) signalingClient.sendIceCandidate(candidate);
    });

    signalingClient.open();
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
    state === "fetching"
      ? "Loading stream credentials…"
      : state === "connecting" || state === "reconnecting"
        ? "Connecting to live feed…"
        : state === "live"
          ? "Live"
          : state === "ended"
            ? "Stream ended"
            : state === "error"
              ? error ?? "Connection error"
              : "Starting…";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">{deviceName}</p>
          <p className="text-xs text-slate-400">{statusLabel}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        ) : null}
      </div>
      <div className="aspect-video overflow-hidden rounded-md border border-slate-800 bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
      </div>
      {state === "error" ? (
        <button
          type="button"
          onClick={() => void connect()}
          className="mt-2 text-sm text-sky-300 underline"
        >
          Retry connection
        </button>
      ) : null}
    </div>
  );
}
