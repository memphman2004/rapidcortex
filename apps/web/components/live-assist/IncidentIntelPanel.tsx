"use client";

/**
 * IncidentIntelPanel — Bottom panel
 *
 * Displays relevant operational intelligence for the active session:
 *   - Associated incident information
 *   - Continuity Log events (session timeline)
 *   - Coaching and stream events
 *
 * Never displays invented live data or simulations as actual events.
 */
import type { LiveAssistSession, LiveAssistEvent } from "rapid-cortex-shared";

const EVENT_LABEL: Partial<Record<string, string>> = {
  SESSION_CREATED:         "Session created",
  DEVICE_ASSOCIATED:       "Device associated",
  INCIDENT_ASSOCIATED:     "Incident linked",
  STREAM_REQUESTED:        "Stream requested",
  STREAM_STARTED:          "Stream started",
  STREAM_DEGRADED:         "Stream degraded",
  STREAM_INTERRUPTED:      "Stream interrupted",
  STREAM_RECONNECTED:      "Stream reconnected",
  STREAM_ENDED:            "Stream ended",
  VIEWER_JOINED:           "Viewer joined",
  VIEWER_LEFT:             "Viewer left",
  LOCATION_UPDATED:        "Location updated",
  COACHING_REQUESTED:      "Coaching requested",
  COACHING_OFFICER_NOTIFIED: "Officer notified",
  COACHING_ACCEPTED:       "Coaching accepted",
  COACHING_STARTED:        "Coaching active",
  COACHING_SUPERVISOR_MUTED: "Supervisor muted",
  COACHING_SUPERVISOR_UNMUTED: "Supervisor unmuted",
  COACHING_OFFICER_MUTED:  "Officer muted",
  COACHING_OFFICER_UNMUTED:"Officer unmuted",
  COACHING_FLOOR_TRANSFERRED: "Coaching transferred",
  COACHING_ENDED:          "Coaching ended",
  SESSION_ENDED:           "Session ended",
  NOTE_ADDED:              "Note added",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return iso; }
}

function eventColor(eventType: string): string {
  if (eventType.includes("STARTED") || eventType.includes("CREATED")) return "text-green-400";
  if (eventType.includes("ENDED") || eventType.includes("TERMINATED")) return "text-red-400";
  if (eventType.includes("COACHING")) return "text-sky-400";
  if (eventType.includes("STREAM")) return "text-blue-400";
  if (eventType.includes("DEGRADED") || eventType.includes("INTERRUPTED")) return "text-orange-400";
  return "text-slate-400";
}

interface IncidentIntelPanelProps {
  session: LiveAssistSession | null;
  events: LiveAssistEvent[];
  selectedIncidentId: string | null;
  incidents: Array<{ incidentId: string; title: string }>;
}

export function IncidentIntelPanel({ session, events, selectedIncidentId, incidents }: IncidentIntelPanelProps) {
  const incident = incidents.find(
    (i) => i.incidentId === (selectedIncidentId ?? session?.incidentId),
  );

  return (
    <div className="flex h-full gap-0">
      {/* Incident info */}
      <div className="w-64 shrink-0 border-r border-slate-800 p-3 overflow-y-auto">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Incident</div>
        {incident ? (
          <div>
            <p className="text-xs text-white font-medium">{incident.title}</p>
            <p className="mt-0.5 text-[10px] text-slate-500 font-mono">{incident.incidentId}</p>
            <p className="mt-2 text-[10px] text-slate-600 italic">
              CAD context, call summary, and additional dispatch information will appear here when available.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">
            {session?.incidentId ? `Inc: ${session.incidentId}` : "No incident associated"}
          </p>
        )}
      </div>

      {/* Continuity Log */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
          Continuity Log
          {events.length > 0 && (
            <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">{events.length}</span>
          )}
        </div>
        {events.length === 0 ? (
          <p className="text-xs text-slate-600 italic">
            {session ? "No events yet for this session." : "Select a session to view its continuity log."}
          </p>
        ) : (
          <div className="space-y-0.5">
            {events.map((evt) => (
              <div key={evt.eventId} className="flex items-baseline gap-2 text-[11px]">
                <span className="shrink-0 text-slate-600 font-mono">{formatTime(evt.timestamp)}</span>
                <span className={eventColor(evt.eventType)}>
                  {EVENT_LABEL[evt.eventType] ?? evt.eventType}
                </span>
                <span className="text-slate-600 font-mono text-[9px] truncate">
                  {evt.actorId !== "system" ? `by ${evt.actorId.slice(0, 12)}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
