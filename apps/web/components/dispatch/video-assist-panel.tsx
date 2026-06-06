"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VideoAssistDispatcherSession, VideoAssistSessionEvent } from "rapid-cortex-shared";
import {
  fetchVideoAssistSession,
  fetchVideoAssistSessions,
  isApiConfigured,
  postTranscriptSegment,
  postVideoAssistCancel,
  postVideoAssistDispatcherSignal,
  postVideoAssistMarkLive,
  postVideoAssistResend,
  postVideoAssistSession,
} from "@/lib/api";

const DEFAULT_ICE: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function statusLabel(status: VideoAssistDispatcherSession["status"]): string {
  const map: Record<VideoAssistDispatcherSession["status"], string> = {
    pending_send: "Link not sent",
    sms_sent: "SMS sent",
    delivered: "Delivered (if supported)",
    opened: "Link opened",
    consent_pending: "Consent recorded",
    permission_pending: "Camera permission pending",
    connecting: "Connecting…",
    live: "Live",
    paused: "Paused / interrupted",
    ended: "Ended",
    failed: "Failed",
    canceled: "Canceled",
  };
  return map[status] ?? status;
}

function mergeRemoteIce(
  pc: RTCPeerConnection,
  candidates: string[] | undefined,
  seen: Set<string>,
): void {
  if (!candidates?.length) return;
  for (const json of candidates) {
    if (seen.has(json)) continue;
    seen.add(json);
    try {
      const init = JSON.parse(json) as RTCIceCandidateInit;
      if (!init?.candidate) continue;
      void pc.addIceCandidate(new RTCIceCandidate(init));
    } catch {
      /* ignore malformed */
    }
  }
}

export function VideoAssistPanel({ incidentId }: { incidentId: string | null }) {
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [publicBase, setPublicBase] = useState("");
  const [showRequest, setShowRequest] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const offerKeyRef = useRef<string | null>(null);
  const callerIceSeenRef = useRef(new Set<string>());
  const dispatcherIcePostedRef = useRef(new Set<string>());
  const liveMarkedRef = useRef(false);

  const configured = isApiConfigured();

  const sessionsQuery = useQuery({
    queryKey: ["video-assist-sessions", incidentId],
    enabled: Boolean(incidentId) && configured,
    queryFn: () => fetchVideoAssistSessions(incidentId!),
    staleTime: 8_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (activeSessionId || !sessionsQuery.data?.length) return;
    const preferred = sessionsQuery.data.find((s) => !["ended", "canceled", "failed"].includes(s.status));
    setActiveSessionId((preferred ?? sessionsQuery.data[0]).sessionId);
  }, [sessionsQuery.data, activeSessionId]);

  const sessionQuery = useQuery({
    queryKey: ["video-assist-session", incidentId, activeSessionId],
    enabled: Boolean(incidentId && activeSessionId && configured),
    queryFn: () => fetchVideoAssistSession(incidentId!, activeSessionId!),
    staleTime: 2_500,
    refetchIntervalInBackground: false,
    refetchInterval: (q) => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return 10_000;
      }
      const st = q.state.data?.status;
      if (!st || ["ended", "canceled", "failed"].includes(st)) return false;
      if (st === "connecting") return 2_000;
      return 3_000;
    },
  });

  const session = sessionQuery.data;
  const callerOfferSdp = session?.callerOfferSdp ?? null;
  const sessionStatus = session?.status;
  const callerIce = session?.iceCaller;

  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !session?.iceCaller?.length) return;
    mergeRemoteIce(pc, session.iceCaller, callerIceSeenRef.current);
  }, [session?.iceCaller]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!incidentId || !activeSessionId) return;
    if (!callerOfferSdp || sessionStatus === "ended" || sessionStatus === "canceled") {
      pcRef.current?.close();
      pcRef.current = null;
      offerKeyRef.current = null;
      callerIceSeenRef.current.clear();
      dispatcherIcePostedRef.current.clear();
      liveMarkedRef.current = false;
      if (videoEl) videoEl.srcObject = null;
      return;
    }

    const offerKey = `${activeSessionId}:${callerOfferSdp}`;
    if (offerKeyRef.current === offerKey && pcRef.current) return;

    let cancelled = false;
    pcRef.current?.close();
    pcRef.current = null;
    offerKeyRef.current = null;
    callerIceSeenRef.current.clear();
    dispatcherIcePostedRef.current.clear();
    liveMarkedRef.current = false;

    const pc = new RTCPeerConnection(DEFAULT_ICE);
    pcRef.current = pc;

    pc.ontrack = (ev) => {
      const el = videoRef.current;
      if (!el) return;
      el.srcObject = ev.streams[0];
      if (!liveMarkedRef.current) {
        liveMarkedRef.current = true;
        void postVideoAssistMarkLive(incidentId, activeSessionId).catch(() => {
          liveMarkedRef.current = false;
        });
      }
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const json = JSON.stringify(ev.candidate.toJSON());
      if (dispatcherIcePostedRef.current.has(json)) return;
      dispatcherIcePostedRef.current.add(json);
      void postVideoAssistDispatcherSignal(incidentId, activeSessionId, {
        kind: "ice-dispatcher",
        candidate: json,
      }).catch(() => {
        dispatcherIcePostedRef.current.delete(json);
      });
    };

    void (async () => {
      try {
        await pc.setRemoteDescription({ type: "offer", sdp: callerOfferSdp });
        mergeRemoteIce(pc, callerIce, callerIceSeenRef.current);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (cancelled) return;
        await postVideoAssistDispatcherSignal(incidentId, activeSessionId, {
          kind: "dispatcher-answer",
          sdp: answer.sdp!,
        });
        if (!cancelled) offerKeyRef.current = offerKey;
      } catch (e) {
        setLocalErr(e instanceof Error ? e.message : "WebRTC negotiation failed");
      }
    })();

    return () => {
      cancelled = true;
      pc.close();
      if (pcRef.current === pc) pcRef.current = null;
      offerKeyRef.current = null;
      if (videoEl) videoEl.srcObject = null;
    };
  }, [incidentId, activeSessionId, callerOfferSdp, sessionStatus, callerIce]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!incidentId) throw new Error("No incident");
      const trimmed = phone.trim();
      if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
        throw new Error("Enter caller phone in E.164 format (e.g. +15551234567).");
      }
      const body: Parameters<typeof postVideoAssistSession>[1] = { callerPhoneE164: trimmed };
      const base = publicBase.trim();
      if (base) body.publicAppBaseUrl = base;
      return postVideoAssistSession(incidentId, body);
    },
    onSuccess: (data) => {
      setLocalErr(null);
      setActiveSessionId(data.session.sessionId);
      setShowRequest(false);
      void queryClient.invalidateQueries({ queryKey: ["video-assist-sessions", incidentId] });
      void queryClient.invalidateQueries({ queryKey: ["video-assist-session", incidentId, data.session.sessionId] });
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const resendMut = useMutation({
    mutationFn: async () => {
      if (!incidentId || !activeSessionId) throw new Error("No session");
      return postVideoAssistResend(incidentId, activeSessionId);
    },
    onSuccess: () => {
      setLocalErr(null);
      void sessionQuery.refetch();
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!incidentId || !activeSessionId) throw new Error("No session");
      return postVideoAssistCancel(incidentId, activeSessionId);
    },
    onSuccess: () => {
      setLocalErr(null);
      void queryClient.invalidateQueries({ queryKey: ["video-assist-sessions", incidentId] });
      void sessionQuery.refetch();
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const appendNote = useCallback(async () => {
    const t = noteText.trim();
    if (!t || !incidentId) return;
    try {
      await postTranscriptSegment(incidentId, {
        speaker: "dispatcher",
        text: `[Video assist] ${t}`,
        timestamp: new Date().toISOString(),
      });
      setNoteText("");
      void queryClient.invalidateQueries({ queryKey: ["transcript", incidentId] });
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Could not save note");
    }
  }, [incidentId, noteText, queryClient]);

  const captureFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v?.videoWidth) {
      setLocalErr("No video frame yet.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-assist-frame-${activeSessionId ?? "session"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [activeSessionId]);

  const recentEvents: VideoAssistSessionEvent[] = useMemo(() => {
    const ev = session?.events ?? [];
    return ev.slice(-12);
  }, [session?.events]);

  if (!incidentId) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Caller Video Assist</h3>
        <p className="mt-1 text-xs text-slate-500">Select an incident to request live video.</p>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Caller Video Assist</h3>
        <p className="mt-1 text-xs text-amber-100/80">
          API is not configured. Connect the dispatch app to your backend to enable SMS sessions and live viewing.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Caller Video Assist</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            One-time SMS link · mobile browser · audit trail on the server
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowRequest((s) => !s);
            setLocalErr(null);
          }}
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
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Public site base (optional)
            <input
              value={publicBase}
              onChange={(e) => setPublicBase(e.target.value)}
              placeholder="https://app.example.com"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
            />
          </label>
          <button
            type="button"
            disabled={createMut.isPending}
            onClick={() => createMut.mutate()}
            className="w-full rounded-md bg-emerald-700 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {createMut.isPending ? "Sending…" : "Send secure link (SMS)"}
          </button>
        </div>
      ) : null}

      {sessionsQuery.data && sessionsQuery.data.length > 0 ? (
        <label className="mt-3 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
          Session
          <select
            value={activeSessionId ?? ""}
            onChange={(e) => setActiveSessionId(e.target.value || null)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-100"
          >
            {sessionsQuery.data.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.sessionId.slice(0, 10)}… · {s.status}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">No video assist sessions for this incident yet.</p>
      )}

      {session ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200 ring-1 ring-slate-600">
              {statusLabel(session.status)}
            </span>
            {session.streamStartedAt ? (
              <span className="text-[10px] text-slate-500">Stream started {new Date(session.streamStartedAt).toLocaleTimeString()}</span>
            ) : null}
          </div>

          <div className="aspect-video w-full overflow-hidden rounded-md border border-slate-800 bg-black">
            <video ref={videoRef} playsInline autoPlay muted className="h-full w-full object-contain" />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={resendMut.isPending || ["ended", "canceled", "failed"].includes(session.status)}
              onClick={() => resendMut.mutate()}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              Resend SMS
            </button>
            <button
              type="button"
              disabled={cancelMut.isPending || ["ended", "canceled"].includes(session.status)}
              onClick={() => cancelMut.mutate()}
              className="rounded border border-rose-900/60 bg-rose-950/40 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-950/60 disabled:opacity-40"
            >
              Cancel session
            </button>
            <button
              type="button"
              onClick={() => void captureFrame()}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              Save frame (local)
            </button>
          </div>

          <div className="rounded border border-slate-800/80 bg-slate-900/40 p-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Notes during stream</div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              placeholder="Appends to incident transcript as [Video assist] …"
            />
            <button
              type="button"
              onClick={() => void appendNote()}
              disabled={!noteText.trim()}
              className="mt-1 rounded bg-slate-700 px-2 py-1 text-[11px] text-white hover:bg-slate-600 disabled:opacity-40"
            >
              Append note
            </button>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recent milestones</div>
            <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-400">
              {recentEvents.length === 0 ? (
                <li className="text-slate-600">No events yet.</li>
              ) : (
                recentEvents.map((ev, i) => (
                  <li key={`${ev.at}-${i}`} className="truncate" title={JSON.stringify(ev.meta ?? {})}>
                    {new Date(ev.at).toLocaleTimeString()} · {ev.type}
                  </li>
                ))
              )}
            </ul>
          </div>

          <p className="text-[10px] leading-snug text-slate-600">
            Supervisor handoff and viewer audit exports follow your agency role matrix in the full deployment.
          </p>
        </div>
      ) : activeSessionId ? (
        <p className="mt-2 text-xs text-slate-500">Loading session…</p>
      ) : null}
    </div>
  );
}
