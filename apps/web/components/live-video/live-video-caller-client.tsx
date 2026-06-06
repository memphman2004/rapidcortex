"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JoinLiveVideoResponse } from "rapid-cortex-shared";
import { startKvsMaster } from "./kvs-webrtc-clients";

function publicPath(token: string, sub: "join" | "heartbeat") {
  return `/api/public/media/live/${encodeURIComponent(token)}/${sub}`;
}

export function LiveVideoCallerClient({ token }: { token: string }) {
  const [session, setSession] = useState<JoinLiveVideoResponse | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const kvsStopRef = useRef<(() => void) | null>(null);
  const seenDispatcherIceRef = useRef(new Set<string>());

  const join = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(publicPath(token, "join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Join failed (${res.status})`);
      const data = (await res.json()) as JoinLiveVideoResponse;
      setSession(data);
      if (data.status === "ended" || data.status === "expired" || data.status === "failed") setEnded(true);
      return data;
    },
    [token],
  );

  const heartbeat = useCallback(
    async (body: Record<string, unknown> = {}) => {
      const res = await fetch(publicPath(token, "heartbeat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "caller", ...body }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as JoinLiveVideoResponse;
      setSession(data);
      return data;
    },
    [token],
  );

  useEffect(() => {
    void join({}).catch((e) => setError(e instanceof Error ? e.message : "Failed to load session"));
  }, [join]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void heartbeat().catch(() => {});
    }, 2000);
    return () => window.clearInterval(id);
  }, [heartbeat]);

  useEffect(() => {
    if (session?.liveVideoPipeline === "aws_kinesis_webrtc") return;
    if (session?.status === "ended" || session?.status === "expired" || session?.status === "failed") return;
    const pc = pcRef.current;
    if (!pc || !session?.answerSdp) return;
    void (async () => {
      try {
        const cur = pc.remoteDescription?.sdp;
        if (cur !== session.answerSdp) {
          await pc.setRemoteDescription({ type: "answer", sdp: session.answerSdp });
        }
        for (const json of session.dispatcherIceCandidates ?? []) {
          if (seenDispatcherIceRef.current.has(json)) continue;
          seenDispatcherIceRef.current.add(json);
          const init = JSON.parse(json) as RTCIceCandidateInit;
          if (init.candidate) await pc.addIceCandidate(new RTCIceCandidate(init));
        }
      } catch {
        // no-op
      }
    })();
  }, [session?.answerSdp, session?.dispatcherIceCandidates, session?.liveVideoPipeline, session?.status]);

  const start = useCallback(async () => {
    if (!consent) return;
    if (!session) {
      setError("Session is still loading. Try again.");
      return;
    }
    setBusy("start");
    setError(null);
    try {
      if (session.liveVideoPipeline === "aws_kinesis_webrtc") {
        const latest = await join({ consentAccepted: true });
        if (latest.kvs && videoRef.current) {
          kvsStopRef.current = startKvsMaster(latest.kvs, videoRef.current, (msg) => setError(msg));
        } else {
          setError("Live video could not be prepared. The session may be misconfigured.");
        }
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const ice =
        session.iceServers?.length && session.iceServers.length > 0
          ? session.iceServers
          : [{ urls: "stun:stun.l.google.com:19302" }];
      const pc = new RTCPeerConnection({ iceServers: ice });
      pcRef.current = pc;
      stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        void heartbeat({ iceCandidate: JSON.stringify(ev.candidate.toJSON()) }).catch(() => {});
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await join({ consentAccepted: true, offerSdp: offer.sdp });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start live video");
    } finally {
      setBusy(null);
    }
  }, [consent, heartbeat, join, session]);

  const end = useCallback(async () => {
    kvsStopRef.current?.();
    kvsStopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    await heartbeat({ markEnded: true }).catch(() => {});
    setEnded(true);
  }, [heartbeat]);

  if (ended) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg items-center justify-center bg-slate-950 px-4 py-10">
        <p className="text-center text-sm text-slate-300">
          This live video session has ended. If dispatch still needs help, they will send a new link.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-lg bg-slate-950 px-4 py-8 text-slate-100">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">Secure Live Video</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Rapid Cortex live support</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">
        A dispatcher requested temporary live video for your active incident. Joining is optional. You can stop at any
        time.
      </p>
      {error ? (
        <p className="mt-4 rounded-md border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : null}
      <label className="mt-6 flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>I understand and agree to share camera and microphone for this incident-related session.</span>
      </label>
      <div className="mt-4 space-y-2">
        <button
          type="button"
          disabled={!consent || busy !== null}
          onClick={() => void start()}
          className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
        >
          {busy === "start" ? "Starting…" : "Start Live Video"}
        </button>
        <button
          type="button"
          onClick={() => void end()}
          className="w-full rounded-xl border border-rose-900/60 bg-rose-950/30 py-2.5 text-sm font-medium text-rose-100 hover:bg-rose-950/50"
        >
          End Session
        </button>
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-black">
        <video ref={videoRef} playsInline autoPlay muted className="aspect-video w-full object-cover" />
      </div>
    </main>
  );
}
