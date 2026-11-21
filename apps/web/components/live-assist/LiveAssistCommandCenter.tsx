"use client";

/**
 * Live Assist Command Center
 *
 * 4-panel layout:
 *   Left   — Officer Roster (devices + session status)
 *   Center — Live Camera Feed (video player + stream controls)
 *   Right  — Officer Assist Panel (coaching, incident, location)
 *   Bottom — Incident Intelligence (CAD context, continuity log)
 *
 * Safety notices:
 *   - Synthetic feeds are always labeled "[SYNTHETIC DEMO — Not a real officer]"
 *   - Coaching is disabled unless RBAC permits canCoachLiveAssist
 *   - Delay warnings show when video latency is significant
 *
 * Live Assist is a human-supervised decision-support capability.
 * It must not make autonomous law enforcement decisions or replace CAD/radio.
 */

import { useState } from "react";
import {
  useSessions,
  useDevices,
  useSession,
  useCreateSession,
  useStartStream,
  useRequestCoaching,
  useTerminateCoaching,
  useEndSession,
  useSessionEvents,
} from "@/lib/live-assist/hooks";
import type { LiveAssistSession, LiveAssistDevice } from "rapid-cortex-shared";
import { OfficerRoster } from "./OfficerRoster";
import { LiveCameraFeed } from "./LiveCameraFeed";
import { OfficerAssistPanel } from "./OfficerAssistPanel";
import { IncidentIntelPanel } from "./IncidentIntelPanel";
import { LiveAssistAdmin } from "./LiveAssistAdmin";

export type LiveAssistView = "operations" | "admin";

interface LiveAssistCommandCenterProps {
  view: LiveAssistView;
  onView: (v: LiveAssistView) => void;
  canCoach: boolean;
  canAdmin: boolean;
  incidents: Array<{ incidentId: string; title: string }>;
  selectedIncidentId: string | null;
}

export function LiveAssistCommandCenter({
  view,
  onView,
  canCoach,
  canAdmin,
  incidents,
  selectedIncidentId,
}: LiveAssistCommandCenterProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const sessionsQuery = useSessions();
  const devicesQuery = useDevices();
  const selectedSession = useSession(selectedSessionId);
  const sessionEventsQuery = useSessionEvents(selectedSessionId);

  const createSession = useCreateSession();
  const startStream = useStartStream();
  const requestCoaching = useRequestCoaching();
  const terminateCoaching = useTerminateCoaching();
  const endSession = useEndSession();

  const sessions = sessionsQuery.data?.sessions ?? [];
  const devices = devicesQuery.data?.devices ?? [];
  const session: LiveAssistSession | null = selectedSession.data?.session ?? null;
  const events = sessionEventsQuery.data?.events ?? [];

  // ── View tabs ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-[#070b14] text-white">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sky-400 font-semibold text-sm tracking-wide">⬡ LIVE ASSIST</span>
          <span className="text-slate-500 text-xs">Real-Time Visibility · Direct Communication · Safer Coordination</span>
        </div>
        <div className="flex gap-2">
          {(["operations", "admin"] as LiveAssistView[]).map((v) => (
            <button
              key={v}
              onClick={() => onView(v)}
              className={`rounded px-3 py-1 text-xs capitalize transition ${
                view === v
                  ? "bg-sky-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "admin" && canAdmin ? (
        <div className="flex-1 overflow-auto p-4">
          <LiveAssistAdmin />
        </div>
      ) : (
        <>
          {/* Main 3-column layout */}
          <div className="flex flex-1 overflow-hidden gap-0">
            {/* Left — Officer Roster */}
            <div className="w-72 shrink-0 border-r border-slate-800 overflow-y-auto">
              <OfficerRoster
                sessions={sessions}
                devices={devices}
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
                onCreateSession={async (deviceId, incidentId) => {
                  const result = await createSession.mutateAsync({ deviceId, incidentId });
                  setSelectedSessionId(result.session.sessionId);
                }}
              />
            </div>

            {/* Center — Live camera feed */}
            <div className="flex-1 overflow-hidden flex flex-col border-r border-slate-800">
              <LiveCameraFeed
                session={session}
                onStartStream={async () => {
                  if (session) await startStream.mutateAsync(session.sessionId);
                }}
                isStartingStream={startStream.isPending}
                canCoach={canCoach}
              />
            </div>

            {/* Right — Officer assist */}
            <div className="w-80 shrink-0 overflow-y-auto">
              <OfficerAssistPanel
                session={session}
                canCoach={canCoach}
                onRequestCoaching={async () => {
                  if (session) await requestCoaching.mutateAsync({ sessionId: session.sessionId });
                }}
                onTerminateCoaching={async () => {
                  if (session) await terminateCoaching.mutateAsync(session.sessionId);
                }}
                onEndSession={async () => {
                  if (session) {
                    await endSession.mutateAsync(session.sessionId);
                    setSelectedSessionId(null);
                  }
                }}
                incidents={incidents}
                isCoachingPending={requestCoaching.isPending}
              />
            </div>
          </div>

          {/* Bottom — Incident intelligence */}
          <div className="h-48 border-t border-slate-800 overflow-y-auto">
            <IncidentIntelPanel
              session={session}
              events={events}
              selectedIncidentId={selectedIncidentId ?? session?.incidentId ?? null}
              incidents={incidents}
            />
          </div>
        </>
      )}
    </div>
  );
}
