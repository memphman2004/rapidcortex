"use client";

import { useState } from "react";
import type { TimelineEvent, TimelineEventKind, TimelineEventSource } from "rapid-cortex-shared";

const KIND_LABELS: Record<TimelineEventKind, string> = {
  call_received: "Call received",
  transcription_started: "Transcription started",
  ai_analysis_created: "AI analysis",
  unit_dispatched: "Unit dispatched",
  unit_status_changed: "Unit status",
  cad_synced: "CAD synced",
  supervisor_joined: "Supervisor joined",
  translation_activated: "Translation",
  media_requested: "Media requested",
  media_received: "Media received",
  manual_override: "Manual override",
  dispatcher_note: "Dispatcher note",
  hospital_prealert_sent: "Hospital pre-alert sent",
  hospital_prealert_acknowledged: "Hospital pre-alert acknowledged",
  hospital_prealert_failed: "Hospital pre-alert failed",
  hospital_prealert_cancelled: "Hospital pre-alert cancelled",
  call_ended: "Call ended",
  incident_closed: "Incident closed",
  sms_received: "SMS received",
  report_submitted: "Report submitted",
  auto_reply_sent: "Location link sent",
  location_received: "Location received",
  chat_message_received: "Follow-up message",
};

const SOURCE_COLORS: Record<TimelineEventSource, string> = {
  system: "border-sky-500/40 bg-sky-950/30 text-sky-200",
  dispatcher: "border-slate-500/40 bg-slate-900/60 text-slate-100",
  supervisor: "border-violet-500/40 bg-violet-950/30 text-violet-100",
  cad: "border-emerald-500/40 bg-emerald-950/30 text-emerald-100",
  ai: "border-amber-500/40 bg-amber-950/30 text-amber-100",
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return iso;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return new Date(iso).toLocaleString();
}

function payloadSummary(event: TimelineEvent): string {
  const p = event.payload;
  if (event.kind === "dispatcher_note" && typeof p.content === "string") {
    return p.content.length > 120 ? `${p.content.slice(0, 120)}…` : p.content;
  }
  if (typeof p.summary === "string") return p.summary;
  if (typeof p.category === "string") return `Category: ${p.category}`;
  if (typeof p.vendor === "string") return `CAD: ${p.vendor}`;
  const keys = Object.keys(p);
  return keys.length ? `${keys.length} field(s)` : "—";
}

function kindIcon(kind: TimelineEventKind): string {
  switch (kind) {
    case "ai_analysis_created":
      return "AI";
    case "cad_synced":
      return "CAD";
    case "dispatcher_note":
      return "Note";
    case "transcription_started":
      return "Tx";
    case "manual_override":
      return "Ovr";
    case "hospital_prealert_sent":
    case "hospital_prealert_acknowledged":
    case "hospital_prealert_failed":
    case "hospital_prealert_cancelled":
      return "Hosp";
    default:
      return "•";
  }
}

export function TimelineEventRow({ event }: { event: TimelineEvent }) {
  const [open, setOpen] = useState(false);
  const color = SOURCE_COLORS[event.source];

  return (
    <li className={`rounded-lg border px-3 py-2 ${color}`}>
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950/50 text-[10px] font-bold ring-1 ring-slate-700">
          {kindIcon(event.kind)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{KIND_LABELS[event.kind]}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-500">{event.source}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-300">{payloadSummary(event)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <time dateTime={event.timestamp} title={new Date(event.timestamp).toLocaleString()}>
              {relativeTime(event.timestamp)}
            </time>
            {event.actorId ? (
              <span className="rounded-full bg-slate-950/60 px-2 py-0.5 font-mono text-slate-400">{event.actorId}</span>
            ) : null}
          </div>
        </div>
      </button>
      {open ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-950/80 p-2 text-[10px] text-slate-400">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}
