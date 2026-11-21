"use client";

/**
 * OfficerAssistPanel — Right panel
 *
 * Displays:
 *   - Officer / unit details
 *   - Associated incident details
 *   - GPS location (source-labeled, freshness-stamped)
 *   - Coaching channel state and PTT controls (live WebRTC audio via KVS)
 *   - End session control
 *
 * Phase 2:
 *   - useCoachingToken fetches KVS MASTER credentials when coaching is active
 *   - useCoachingWebRtc manages the RTCPeerConnection as SINGLE_MASTER
 *   - PTT button opens the microphone on pointer-down, mutes on pointer-up
 *   - Mic permission is requested on first PTT press, never on mount
 *
 * Safety:
 *   - Coaching only shown if canCoach = true
 *   - Old location data is visually distinguished from current
 *   - Coaching not automatically activated — requires explicit action
 */
import { useCallback, useState } from "react";
import type { LiveAssistSession } from "rapid-cortex-shared";
import { useCoachingToken, usePtt } from "@/lib/live-assist/hooks";
import { useCoachingWebRtc } from "@/lib/live-assist/useCoachingWebRtc";

interface OfficerAssistPanelProps {
  session: LiveAssistSession | null;
  canCoach: boolean;
  onRequestCoaching: () => Promise<void>;
  onTerminateCoaching: () => Promise<void>;
  onEndSession: () => Promise<void>;
  incidents: Array<{ incidentId: string; title: string }>;
  isCoachingPending: boolean;
}

function formatTimeDiff(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

const COACHING_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  none:            { label: "No coaching channel",    cls: "text-slate-500" },
  requested:       { label: "Waiting for officer…",   cls: "text-yellow-400 animate-pulse" },
  officer_notified:{ label: "Officer notified…",      cls: "text-yellow-400 animate-pulse" },
  active:          { label: "● Coaching active",      cls: "text-green-400 font-semibold" },
  muted:           { label: "Coaching muted",         cls: "text-slate-400" },
  ended:           { label: "Coaching ended",         cls: "text-slate-600" },
};

export function OfficerAssistPanel({
  session,
  canCoach,
  onRequestCoaching,
  onTerminateCoaching,
  onEndSession,
  incidents,
  isCoachingPending,
}: OfficerAssistPanelProps) {
  const isCoachingActive = session?.coachingStatus === "active";

  // ── WebRTC coaching channel (supervisor = MASTER) ──────────────────────────
  // Token is only fetched when coaching is active and the supervisor can coach.
  const tokenQuery = useCoachingToken(
    session?.sessionId ?? null,
    "master",
    isCoachingActive && canCoach,
  );
  const pttMutation = usePtt(session?.sessionId ?? null);
  const [pttError, setPttError] = useState<string | null>(null);

  const handlePttStateChange = useCallback(
    (active: boolean) => {
      // Fire backend event (best-effort; non-fatal if it fails)
      pttMutation.mutate(active);
    },
    [pttMutation],
  );

  const { connectionState, isPttActive, startPtt, stopPtt, error: rtcError } =
    useCoachingWebRtc({
      token: isCoachingActive && canCoach ? tokenQuery.data : null,
      onPttStateChange: handlePttStateChange,
    });

  // PTT press handlers (pointer events work for both mouse and touch)
  const handlePttDown = useCallback(async () => {
    setPttError(null);
    try {
      await startPtt();
    } catch (err) {
      setPttError(err instanceof Error ? err.message : "PTT error");
    }
  }, [startPtt]);

  const handlePttUp = useCallback(() => {
    stopPtt();
  }, [stopPtt]);

  if (!session) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <p className="text-xs text-slate-600 text-center">Select an active session to view officer details</p>
      </div>
    );
  }

  const incident = incidents.find((i) => i.incidentId === session.incidentId);
  const locationAge = session.lastLocationAt
    ? Date.now() - new Date(session.lastLocationAt).getTime()
    : null;
  const locationIsStale = locationAge !== null && locationAge > 60_000;
  const coachingState = COACHING_STATUS_LABEL[session.coachingStatus] ??
    { label: session.coachingStatus, cls: "text-slate-400" };

  const isCoachingPendingState = session.coachingStatus === "requested" || session.coachingStatus === "officer_notified";
  const canStartCoaching = canCoach && session.coachingStatus === "none" && session.streamStatus !== "ended";
  const canEndCoaching = canCoach && (isCoachingActive || isCoachingPendingState);

  const rtcConnected = connectionState === "connected";
  const rtcConnecting = connectionState === "connecting" || connectionState === "reconnecting";
  const micBlocked = connectionState === "mic_permission_denied";

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Officer details */}
      <section>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Officer</div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">ID</span>
            <span className="text-white font-mono">{session.officerId ?? "—"}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Unit</span>
            <span className="text-white font-mono">—</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Camera</span>
            <span className="text-white capitalize">{session.manufacturer}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Device ID</span>
            <span className="text-white font-mono text-[10px]">{session.deviceId.slice(0, 12)}…</span>
          </div>
        </div>
      </section>

      {/* Incident */}
      {incident && (
        <section>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Incident</div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-xs text-white font-medium truncate">{incident.title}</p>
            <p className="mt-0.5 text-[10px] text-slate-500 font-mono">{incident.incidentId}</p>
          </div>
        </section>
      )}

      {/* GPS Location */}
      <section>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Location</div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-1">
          {session.lastLatitude !== null ? (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Coordinates</span>
                <span className={`font-mono ${locationIsStale ? "text-orange-400" : "text-white"}`}>
                  {session.lastLatitude.toFixed(5)}, {session.lastLongitude?.toFixed(5)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Source</span>
                <span className="text-slate-300 capitalize">{(session.locationSource ?? "unknown").replace("_", " ")}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Updated</span>
                <span className={locationIsStale ? "text-orange-400 font-semibold" : "text-slate-300"}>
                  {formatTimeDiff(session.lastLocationAt)}
                  {locationIsStale && " ⚠ stale"}
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-600">No GPS data available</p>
          )}
        </div>
      </section>

      {/* Coaching */}
      {canCoach && (
        <section>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Officer Coaching</div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-3">
            <p className={`text-xs ${coachingState.cls}`}>{coachingState.label}</p>

            {canStartCoaching && (
              <button
                onClick={() => void onRequestCoaching()}
                disabled={isCoachingPending}
                className="w-full rounded bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50 transition"
              >
                {isCoachingPending ? "Requesting…" : "Request Coaching Session"}
              </button>
            )}

            {isCoachingActive && (
              <div className="space-y-2">
                {/* WebRTC channel status */}
                {rtcConnecting && (
                  <p className="text-[10px] text-yellow-500 animate-pulse text-center">
                    Connecting audio channel…
                  </p>
                )}
                {micBlocked && (
                  <p className="text-[10px] text-red-400 text-center">
                    ⚠ Microphone blocked. Enable in browser settings.
                  </p>
                )}
                {rtcError && !micBlocked && (
                  <p className="text-[10px] text-orange-400 text-center truncate" title={rtcError}>
                    Audio: {rtcError}
                  </p>
                )}
                {pttError && (
                  <p className="text-[10px] text-orange-400 text-center">{pttError}</p>
                )}

                {/* PTT button — hold to open mic */}
                <button
                  onPointerDown={() => void handlePttDown()}
                  onPointerUp={handlePttUp}
                  onPointerLeave={handlePttUp}
                  disabled={!rtcConnected || micBlocked}
                  className={[
                    "w-full rounded px-3 py-2.5 text-xs font-bold text-white select-none transition",
                    "active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
                    isPttActive
                      ? "bg-red-600 hover:bg-red-500 ring-2 ring-red-400 animate-pulse"
                      : "bg-green-700 hover:bg-green-600",
                  ].join(" ")}
                >
                  {isPttActive ? "🔴 Speaking…" : "🎙 Hold to Talk (PTT)"}
                </button>
                <p className="text-[10px] text-slate-600 text-center">
                  {rtcConnected
                    ? "Audio channel ready · hold for mic"
                    : "Establishing secure audio channel…"}
                </p>
              </div>
            )}

            {canEndCoaching && (
              <button
                onClick={() => void onTerminateCoaching()}
                className="w-full rounded border border-red-900 bg-transparent px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 transition"
              >
                End Coaching
              </button>
            )}

            <p className="text-[10px] text-slate-700 leading-relaxed">
              Coaching audio is on a separate channel from the camera feed.
              Ending coaching does not end the stream.
            </p>
          </div>
        </section>
      )}

      {/* End session */}
      {session.streamStatus !== "ended" && (
        <button
          onClick={() => void onEndSession()}
          className="mt-auto w-full rounded border border-slate-700 bg-transparent px-3 py-2 text-xs text-slate-400 hover:border-red-800 hover:text-red-400 transition"
        >
          End Live Assist Session
        </button>
      )}
    </div>
  );
}
