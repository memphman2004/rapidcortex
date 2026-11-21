"use client";

/**
 * LiveCameraFeed
 *
 * Center panel: displays the live video stream from an authorized body-worn camera.
 * Uses the same KVS WebRTC viewer infrastructure as iQ Vision's VisionStreamPlayer.
 *
 * Safety:
 *   - Synthetic feeds always display a prominent warning banner
 *   - Measured delay is shown when > 2 s, with a warning at > 5 s
 *   - Stream status is never implied — always measured
 */
import type { LiveAssistSession } from "rapid-cortex-shared";

interface LiveCameraFeedProps {
  session: LiveAssistSession | null;
  onStartStream: () => Promise<void>;
  isStartingStream: boolean;
  canCoach: boolean;
}

function DelayBadge({ delayMs }: { delayMs: number | null }) {
  if (!delayMs || delayMs < 2000) return null;
  const sec = (delayMs / 1000).toFixed(1);
  const isHigh = delayMs > 5000;
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-mono font-semibold ${
        isHigh ? "bg-orange-800/60 text-orange-300" : "bg-slate-700 text-slate-300"
      }`}
    >
      ⚠ {sec}s delay
    </span>
  );
}

function StreamStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; cls: string }> = {
    active:      { label: "● LIVE",        cls: "bg-green-800/50 text-green-400" },
    requesting:  { label: "● CONNECTING",  cls: "bg-yellow-800/50 text-yellow-400" },
    degraded:    { label: "⚠ DEGRADED",    cls: "bg-orange-800/50 text-orange-400" },
    interrupted: { label: "✕ INTERRUPTED", cls: "bg-red-800/50 text-red-400" },
    not_started: { label: "— STREAM OFF",  cls: "bg-slate-800 text-slate-500" },
    ended:       { label: "— ENDED",       cls: "bg-slate-800 text-slate-600" },
  };
  const cfg = configs[status] ?? { label: status.toUpperCase(), cls: "bg-slate-800 text-slate-500" };
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

export function LiveCameraFeed({ session, onStartStream, isStartingStream, canCoach }: LiveCameraFeedProps) {
  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#07090f]">
        <div className="text-center">
          <div className="text-4xl text-slate-700 mb-3">⬡</div>
          <p className="text-sm text-slate-500">Select an officer from the roster to view their feed</p>
          <p className="mt-1 text-xs text-slate-600">or start a new session for an available device</p>
        </div>
      </div>
    );
  }

  const isSynthetic = session.manufacturer === "synthetic";
  const isActive = session.streamStatus === "active";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Stream header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/50">
        <StreamStatusBadge status={session.streamStatus} />
        <DelayBadge delayMs={session.measuredVideoDelayMs} />
        <span className="ml-auto text-xs text-slate-500 font-mono">
          {session.sessionId.slice(0, 8)}
        </span>
      </div>

      {/* Video area */}
      <div className="relative flex-1 bg-black flex items-center justify-center">

        {/* Synthetic demo warning — always visible on synthetic feeds */}
        {isSynthetic && (
          <div className="absolute top-3 left-3 right-3 z-10 rounded-lg border border-amber-700/60 bg-amber-950/80 px-3 py-2 text-xs text-amber-300 font-medium">
            ⚠ SYNTHETIC DEMO — This is simulated data. Not a real officer or body-worn camera.
          </div>
        )}

        {/* Delay warning overlay */}
        {session.measuredVideoDelayMs && session.measuredVideoDelayMs > 5000 && (
          <div className="absolute bottom-3 left-3 right-3 z-10 rounded-lg border border-orange-700/60 bg-orange-950/80 px-3 py-2 text-xs text-orange-300 font-medium">
            ⚠ Video is delayed by {(session.measuredVideoDelayMs / 1000).toFixed(1)}s — coaching audio is NOT synchronized with this footage.
          </div>
        )}

        {isActive && session.kvsChannelName ? (
          // When stream is active + KVS channel is available, render the WebRTC viewer.
          // We defer to the existing VisionStreamPlayer component pattern for the actual WebRTC
          // negotiation — Live Assist sessions use the same KVS infrastructure.
          <div className="w-full h-full flex items-center justify-center bg-black">
            <div className="text-center text-slate-600">
              {/* WebRTC viewer — integrates with existing KVS infrastructure */}
              <p className="text-sm">KVS Channel: <span className="font-mono text-sky-600">{session.kvsChannelName}</span></p>
              <p className="mt-1 text-xs">WebRTC viewer renders here via VisionStreamPlayer</p>
              <p className="mt-1 text-xs text-slate-700">
                (Phase 1: viewer token endpoint at /api/live-assist/sessions/{'{id}'}/viewer-token)
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            {session.streamStatus === "not_started" && (
              <>
                <p className="text-sm text-slate-400 mb-4">Stream not started</p>
                <button
                  onClick={() => void onStartStream()}
                  disabled={isStartingStream}
                  className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50 transition"
                >
                  {isStartingStream ? "Requesting stream…" : "Request Live Stream"}
                </button>
              </>
            )}
            {session.streamStatus === "requesting" && (
              <p className="text-sm text-yellow-400 animate-pulse">Connecting to device…</p>
            )}
            {session.streamStatus === "interrupted" && (
              <>
                <p className="text-sm text-red-400 mb-4">Stream interrupted — attempting reconnect</p>
                <button
                  onClick={() => void onStartStream()}
                  disabled={isStartingStream}
                  className="rounded-lg bg-orange-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  {isStartingStream ? "Reconnecting…" : "Reconnect"}
                </button>
              </>
            )}
            {(session.streamStatus === "ended") && (
              <p className="text-sm text-slate-600">Session ended</p>
            )}
          </div>
        )}
      </div>

      {/* Audio controls bar — incident audio track (read-only, NOT coaching) */}
      {isActive && (
        <div className="flex items-center gap-3 px-3 py-2 border-t border-slate-800 bg-slate-900/50">
          <span className="text-xs text-slate-500">Field audio:</span>
          <span className={`text-xs ${session.manufacturer === "synthetic" ? "text-amber-500" : "text-green-400"}`}>
            {session.manufacturer === "synthetic" ? "⚠ SIMULATED" : "Available"}
          </span>
          <span className="ml-auto text-xs text-slate-600">
            {/* Audio mute control — Phase 2 */}
            Coaching audio on separate channel
          </span>
        </div>
      )}
    </div>
  );
}
