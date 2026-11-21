"use client";

import type { LiveAssistSession, LiveAssistDevice } from "rapid-cortex-shared";

const MANUFACTURER_LABELS: Record<string, string> = {
  synthetic: "⚠ DEMO",
  getac:     "Getac BC-04",
  axon:      "Axon Body",
  motorola:  "Motorola V700",
  axis:      "Axis BWC",
  zepcam:    "ZEPCAM",
  rtsp:      "RTSP",
  webrtc:    "WebRTC",
};

function streamStatusDot(status: string) {
  if (status === "active")     return <span className="inline-block h-2 w-2 rounded-full bg-green-400" />;
  if (status === "requesting") return <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />;
  if (status === "degraded" || status === "interrupted") return <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-slate-600" />;
}

function coachingBadge(status: string) {
  if (status === "active") return <span className="rounded bg-sky-700/40 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">COACHING</span>;
  if (status === "requested" || status === "officer_notified") return <span className="rounded bg-yellow-700/40 px-1.5 py-0.5 text-[10px] font-medium text-yellow-300">PENDING</span>;
  return null;
}

interface OfficerRosterProps {
  sessions: LiveAssistSession[];
  devices: LiveAssistDevice[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: (deviceId: string, incidentId?: string) => Promise<void>;
}

export function OfficerRoster({
  sessions,
  devices,
  selectedSessionId,
  onSelectSession,
  onCreateSession,
}: OfficerRosterProps) {
  // Devices that don't yet have an active session
  const activeSessions = sessions.filter((s) => s.streamStatus !== "ended");
  const activeDeviceIds = new Set(activeSessions.map((s) => s.deviceId));
  const availableDevices = devices.filter((d) => !activeDeviceIds.has(d.deviceId));

  return (
    <div className="p-3 flex flex-col gap-2">
      {/* Header */}
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
        Officer Roster
      </div>

      {/* Active sessions */}
      {activeSessions.length === 0 && availableDevices.length === 0 && (
        <p className="text-xs text-slate-500 italic mt-2">
          No devices registered. Configure a camera provider in Administration.
        </p>
      )}

      {activeSessions.map((session) => {
        const device = devices.find((d) => d.deviceId === session.deviceId);
        const isSelected = session.sessionId === selectedSessionId;
        const isSynthetic = session.manufacturer === "synthetic";
        return (
          <button
            key={session.sessionId}
            onClick={() => onSelectSession(session.sessionId)}
            className={`w-full rounded-lg border p-2.5 text-left transition ${
              isSelected
                ? "border-sky-600 bg-sky-950/50"
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {streamStatusDot(session.streamStatus)}
                <span className="text-xs font-medium text-white truncate max-w-[120px]">
                  {session.officerId ?? device?.agencyUnitId ?? "Unknown Officer"}
                </span>
              </div>
              {coachingBadge(session.coachingStatus)}
            </div>

            <div className="mt-1 text-[10px] text-slate-400 truncate">
              {MANUFACTURER_LABELS[session.manufacturer] ?? session.manufacturer}
              {device?.model ? ` · ${device.model}` : ""}
            </div>

            {session.incidentId && (
              <div className="mt-0.5 text-[10px] text-slate-500 truncate">
                Inc: {session.incidentId.slice(0, 12)}…
              </div>
            )}

            {isSynthetic && (
              <div className="mt-1 rounded bg-amber-900/30 px-1.5 py-0.5 text-[9px] text-amber-400 font-medium">
                SYNTHETIC DEMO — Not a real officer
              </div>
            )}
          </button>
        );
      })}

      {/* Available devices — can be used to start new sessions */}
      {availableDevices.length > 0 && (
        <>
          <div className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Available Devices
          </div>
          {availableDevices.map((device) => (
            <button
              key={device.deviceId}
              onClick={() => void onCreateSession(device.deviceId)}
              className="w-full rounded-lg border border-dashed border-slate-700 p-2.5 text-left hover:border-sky-800 hover:bg-sky-950/20 transition"
            >
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-600" />
                <span className="text-xs text-slate-300 truncate">
                  {device.assignedOfficerId ?? device.agencyUnitId ?? device.providerDeviceId}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                {MANUFACTURER_LABELS[device.manufacturer] ?? device.manufacturer}
                {device.model ? ` · ${device.model}` : ""}
              </div>
              <div className="mt-1 text-[10px] text-sky-500 font-medium">Start Session →</div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
