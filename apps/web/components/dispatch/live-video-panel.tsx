"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  fetchLiveVideoPlayback,
  fetchLiveVideoSession,
  postLiveVideoDispatcherHeartbeat,
  postLiveVideoEnd,
  postLiveVideoRequest,
} from "@/lib/api";
import { startKvsViewer } from "@/components/live-video/kvs-webrtc-clients";

const DEFAULT_ICE: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function LiveVideoPanel({ incidentId }: { incidentId: string | null }) {
  const [phone, setPhone] = useState("");
  const [showRequest, setShowRequest] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callerIceSeenRef = useRef(new Set<string>());
  const dispatcherIcePostedRef = useRef(new Set<string>());
  const kvsStopRef = useRef<(() => void) | null>(null);
  const kvsInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    kvsInitKeyRef.current = null;
  }, [incidentId]);

  const sessionQuery = useQuery({
    queryKey: ["live-video-session", incidentId],
    enabled: Boolean(incidentId),
    queryFn: () => fetchLiveVideoSession(incidentId!),
    staleTime: 3_000,
    refetchIntervalInBackground: false,
    refetchInterval: (q) => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return 10_000;
      }
      const st = q.state.data?.status;
      if (!st || st === "ended" || st === "expired" || st === "failed") return false;
      if (q.state.data?.kvs) return 8000;
      return 3000;
    },
  });

  const session = sessionQuery.data;

  const playbackQuery = useQuery({
    queryKey: ["live-video-playback", incidentId],
    enabled: Boolean(
      incidentId &&
        session &&
        session.storageMode === "kvs-ingestion" &&
        (session.status === "ended" || session.status === "expired" || session.status === "failed"),
    ),
    queryFn: () => fetchLiveVideoPlayback(incidentId!),
    staleTime: 10_000,
    refetchIntervalInBackground: false,
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 10_000 : false),
  });

  const playback = playbackQuery.data;

  useEffect(() => {
    if (!incidentId || !session?.kvs) return;
    if (session.status === "ended" || session.status === "expired" || session.status === "failed") return;
    if (session.status !== "pending" && session.status !== "active") return;
    if (kvsInitKeyRef.current === session.sessionId) return;
    if (!videoRef.current) return;
    kvsStopRef.current?.();
    kvsInitKeyRef.current = session.sessionId;
    kvsStopRef.current = startKvsViewer(session.kvs, videoRef.current, (m) => setLocalErr(m));
    return () => {
      kvsStopRef.current?.();
      kvsStopRef.current = null;
    };
  }, [incidentId, session?.kvs, session?.sessionId, session?.status]);

  useEffect(() => {
    if (session?.liveVideoPipeline === "aws_kinesis_webrtc") return;
    if (!incidentId || !session?.offerSdp || !session.sessionId) return;
    if (session.status === "ended" || session.status === "expired" || session.status === "failed") return;

    const offer = session.offerSdp;
    const pc = new RTCPeerConnection(
      session.iceServers?.length ? { iceServers: session.iceServers } : DEFAULT_ICE,
    );
    pcRef.current?.close();
    pcRef.current = pc;

    pc.ontrack = (ev) => {
      if (videoRef.current) videoRef.current.srcObject = ev.streams[0];
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const json = JSON.stringify(ev.candidate.toJSON());
      if (dispatcherIcePostedRef.current.has(json)) return;
      dispatcherIcePostedRef.current.add(json);
      void postLiveVideoDispatcherHeartbeat(incidentId, {
        role: "dispatcher",
        sessionId: session.sessionId,
        iceCandidate: json,
      }).catch(() => dispatcherIcePostedRef.current.delete(json));
    };

    void (async () => {
      try {
        await pc.setRemoteDescription({ type: "offer", sdp: offer });
        for (const json of session.callerIceCandidates ?? []) {
          if (callerIceSeenRef.current.has(json)) continue;
          callerIceSeenRef.current.add(json);
          const init = JSON.parse(json) as RTCIceCandidateInit;
          if (init.candidate) await pc.addIceCandidate(new RTCIceCandidate(init));
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postLiveVideoDispatcherHeartbeat(incidentId, {
          role: "dispatcher",
          sessionId: session.sessionId,
          answerSdp: answer.sdp ?? undefined,
        });
      } catch (e) {
        setLocalErr(e instanceof Error ? e.message : "Live video negotiation failed");
      }
    })();

    return () => {
      pc.close();
      if (pcRef.current === pc) pcRef.current = null;
    };
  }, [
    incidentId,
    session?.callerIceCandidates,
    session?.iceServers,
    session?.liveVideoPipeline,
    session?.offerSdp,
    session?.sessionId,
    session?.status,
  ]);

  const requestMut = useMutation({
    mutationFn: async () => {
      if (!incidentId) throw new Error("No incident selected");
      const trimmed = phone.trim();
      if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
        throw new Error("Use caller phone in E.164 format, e.g. +15551234567");
      }
      return postLiveVideoRequest(incidentId, { callerPhone: trimmed });
    },
    onSuccess: () => {
      setLocalErr(null);
      setShowRequest(false);
      void sessionQuery.refetch();
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const endMut = useMutation({
    mutationFn: async () => {
      if (!incidentId || !session?.sessionId) throw new Error("No active session");
      kvsStopRef.current?.();
      kvsStopRef.current = null;
      kvsInitKeyRef.current = null;
      return postLiveVideoEnd(incidentId, { sessionId: session.sessionId, reason: "manual" });
    },
    onSuccess: () => {
      setLocalErr(null);
      void sessionQuery.refetch();
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  if (!incidentId) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Live Video</h3>
        <p className="mt-1 text-xs text-slate-500">Select an incident to request live video.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Live Video</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            One-time link · Kinesis Video (WebRTC) or legacy browser WebRTC
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRequest((s) => !s)}
          className="shrink-0 rounded-md bg-sky-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-600"
        >
          Request Live Video
        </button>
      </div>

      {localErr ? (
        <p className="mt-2 text-[11px] text-rose-400" role="alert">
          {localErr}
        </p>
      ) : null}

      {showRequest ? (
        <div className="mt-3 space-y-2 rounded-md border border-slate-800 bg-slate-900/60 p-2">
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Caller mobile (E.164)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
            />
          </label>
          <button
            type="button"
            disabled={requestMut.isPending}
            onClick={() => requestMut.mutate()}
            className="w-full rounded-md bg-emerald-700 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {requestMut.isPending ? "Sending…" : "Send secure live link"}
          </button>
        </div>
      ) : null}

      {session ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200 ring-1 ring-slate-600">
              {session.status}
            </span>
            {session.storageMode === "kvs-ingestion" ? (
              <span
                className="rounded bg-amber-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 ring-1 ring-amber-800/80"
                title={session.channelMediaStorageAttached ? "Signaling channel mapped to Kinesis stream" : "Kinesis stream reserved; live path unchanged"}
              >
                {session.channelMediaStorageAttached ? "Cloud storage (ingest)" : "Recording stream reserved"}
              </span>
            ) : null}
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-md border border-slate-800 bg-black">
            <video ref={videoRef} playsInline autoPlay muted className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={endMut.isPending || session.status === "ended" || session.status === "expired"}
              onClick={() => endMut.mutate()}
              className="rounded border border-rose-900/60 bg-rose-950/40 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-950/60 disabled:opacity-40"
            >
              End session
            </button>
          </div>
          {session.storageMode === "kvs-ingestion" &&
          (session.status === "ended" || session.status === "expired" || session.status === "failed") ? (
            <div className="rounded-md border border-slate-800 bg-slate-900/40 p-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stored recording</h4>
              {playbackQuery.isLoading ? (
                <p className="mt-1 text-[11px] text-slate-500">Loading playback…</p>
              ) : playback?.status === "ready" && playback.hlsPlaybackUrl ? (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] text-slate-500">Short-lived HLS URL (refreshes from API).</p>
                  <video
                    key={playback.hlsUrlExpiresAt}
                    src={playback.hlsPlaybackUrl}
                    controls
                    playsInline
                    className="w-full max-h-48 rounded border border-slate-800 bg-black"
                  />
                  <a
                    href={playback.hlsPlaybackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-[11px] text-sky-400 underline"
                  >
                    Open stream in new tab
                  </a>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">
                  {playback?.message ?? (playback?.status === "processing" ? "Processing…" : "Playback not available yet.")}
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">No live video session for this incident yet.</p>
      )}
    </div>
  );
}
