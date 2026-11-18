"use client";

import { useState } from "react";
import { CategoryBadge } from "@/components/dispatch/badges";
import { TranscriptPanel } from "@/components/dispatch/transcript-panel";
import { locationLabel } from "../fixtures/locations";
import { usePlaybackEngine } from "../hooks/useDemoEngine";
import type { DemoIncident } from "../types";
import type { TranscriptSegment } from "rapid-cortex-shared";
import { formatDemoClock, unitTone } from "./format";

function categoryFor(incident: DemoIncident): "medical" | "fire" | "police" {
  if (incident.discipline === "fire") return "fire";
  if (incident.discipline === "law") return "police";
  return "medical";
}

function toSegments(incident: DemoIncident): TranscriptSegment[] {
  return incident.transcript.map((line, index) => ({
    segmentId: `${incident.id}-${index}`,
    incidentId: incident.id,
    agencyId: "demo-maplewood-county",
    speaker: line.speaker,
    text: line.text,
    timestamp: new Date(Date.UTC(2026, 3, 18, 14, 0, line.offsetSeconds)).toISOString(),
  })) as TranscriptSegment[];
}

export function DemoWorkspace() {
  const snapshot = usePlaybackEngine();
  const state = snapshot.state;
  const [autoScroll, setAutoScroll] = useState(true);
  if (!state) return null;

  const focus =
    state.activeIncidents[state.activeIncidents.length - 1] ??
    state.closedIncidents[state.closedIncidents.length - 1] ??
    null;
  const assist =
    focus?.callAssist ??
    state.callQueue.find((call) => call.callAssist)?.callAssist ??
    "Call Assist is listening. Guidance appears here when a call needs it.";
  const translation = focus?.translation;
  const onShift = state.dispatchers.filter((dispatcher) => dispatcher.onShift);

  return (
    <div className="min-h-[calc(100vh-2.25rem)] bg-[#0f1117] text-slate-100">
      <header
        data-demo-target="dispatcher-view"
        className="border-b border-slate-800 px-4 py-3"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">
              Maplewood County Communications Center
            </p>
            <h1 className="text-xl font-semibold">
              {snapshot.displayName ?? "Demo"} · {state.clockLabel}
            </h1>
            <p className="text-xs text-slate-400">
              Fictional combined PSAP · {state.agency.populationServed.toLocaleString()} residents ·{" "}
              {state.agency.cadDescription}
            </p>
          </div>
          <p className="text-xs text-slate-500">Scenario clock {formatDemoClock(snapshot.offsetSeconds)}</p>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {onShift.map((dispatcher) => (
            <li key={dispatcher.id} className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs">
              <span className="text-slate-500">
                {dispatcher.position ? `Pos ${dispatcher.position}` : "Supervisor"}
                {dispatcher.remote ? " · remote" : ""}
              </span>
              <span className="ml-2 text-slate-100">{dispatcher.name}</span>
            </li>
          ))}
        </ul>
      </header>

      <div className="grid gap-3 p-3 lg:grid-cols-12">
        <section data-demo-target="incoming-call" className="rounded-lg border border-slate-800 bg-slate-950 lg:col-span-3">
          <h2 className="border-b border-slate-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Call queue · {state.metrics.queueDepth} holding
          </h2>
          <ul className="max-h-80 space-y-2 overflow-auto p-3">
            {state.callQueue.length === 0 ? (
              <li className="text-sm text-slate-500">No calls holding.</li>
            ) : (
              state.callQueue.map((call) => (
                <li key={call.id} className="rounded-md border border-slate-800 p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-100">{call.summary}</span>
                    <span className="text-[10px] uppercase text-slate-500">{call.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{locationLabel(call.locationId)}</p>
                  <p className="text-[11px] text-slate-500">{call.phone}</p>
                  {call.repeatCaller ? (
                    <p className="mt-1 text-[11px] font-semibold text-amber-300">Repeat location</p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="flex min-h-[420px] flex-col gap-3 lg:col-span-6">
          <div data-demo-target="transcript" className="min-h-64 flex-1 overflow-hidden rounded-lg border border-slate-800">
            {focus ? (
              <TranscriptPanel
                segments={toSegments(focus)}
                autoScroll={autoScroll}
                onAutoScrollChange={setAutoScroll}
                isStreaming={snapshot.status === "playing"}
                isLoading={false}
                className="min-h-64"
              />
            ) : (
              <p className="p-4 text-sm text-slate-500">Transcription starts when a call is on the board.</p>
            )}
          </div>
          <div data-demo-target="call-assist" className="rounded-lg border border-sky-900/70 bg-sky-950/40 p-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">Call Assist</h2>
            <p className="mt-1 text-sm leading-6 text-sky-50">{assist}</p>
          </div>
          <div data-demo-target="translation" className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Translation</h2>
            <p className="mt-1 text-sm text-slate-200">
              {translation
                ? `${translation.language.toUpperCase()} · ${translation.note}`
                : "No translation on the focused call. Spanish, French, Creole, and Somali appear here when a caller needs them."}
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-3 lg:col-span-3">
          <section data-demo-target="unit-board" className="rounded-lg border border-slate-800 bg-slate-950">
            <h2 className="border-b border-slate-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Units
            </h2>
            <ul className="max-h-72 space-y-1 overflow-auto p-2">
              {state.units.map((unit) => (
                <li key={unit.id} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs">
                  <span>
                    <span className="font-semibold text-slate-100">{unit.id}</span>
                    <span className="ml-2 text-slate-500">{unit.agency}</span>
                  </span>
                  <span className={`rounded px-1.5 py-0.5 uppercase ring-1 ${unitTone(unit.status)}`}>
                    {unit.status.replaceAll("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section data-demo-target="continuity-log" className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Continuity Log</h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              {(focus?.continuity.length ? focus.continuity : ["The log fills itself as the incident moves."]).map(
                (entry) => (
                  <li key={entry}>{entry}</li>
                ),
              )}
            </ul>
          </section>
        </div>

        <section
          data-demo-target="supervisor-dashboard"
          className="rounded-lg border border-slate-800 bg-slate-950 p-3 lg:col-span-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Supervisor</h2>
            {state.coverageGap ? (
              <span className="rounded bg-red-950 px-2 py-0.5 text-[11px] font-semibold text-red-200 ring-1 ring-red-800">
                Coverage gap — no ambulance available
              </span>
            ) : null}
            {state.activeIncidents.some((incident) => incident.mci || incident.major) ? (
              <span className="rounded bg-red-950 px-2 py-0.5 text-[11px] font-semibold text-red-200 ring-1 ring-red-800">
                Major incident
              </span>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {state.activeIncidents.length === 0 ? (
              <p className="text-sm text-slate-500">No active incidents.</p>
            ) : (
              state.activeIncidents.map((incident) => (
                <article key={incident.id} className="rounded-md border border-slate-800 p-2">
                  <div className="flex items-center gap-2">
                    <CategoryBadge value={categoryFor(incident)} />
                    <h3 className="text-sm font-medium">{incident.title}</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{locationLabel(incident.locationId)}</p>
                  <p className="text-xs text-slate-500">Units {incident.units.join(", ") || "—"}</p>
                  {incident.commandNotes.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-200">{incident.commandNotes[incident.commandNotes.length - 1]}</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
          {state.alerts.length > 0 ? (
            <p className="mt-3 text-sm text-amber-100">{state.alerts[state.alerts.length - 1]?.message}</p>
          ) : null}
          {state.shiftSummary ? <p className="mt-2 text-sm text-slate-300">{state.shiftSummary}</p> : null}
          {state.mutualAid.length > 0 ? (
            <p className="mt-2 text-xs text-slate-400">Mutual aid: {state.mutualAid[state.mutualAid.length - 1]}</p>
          ) : null}
        </section>

        <section data-demo-target="admin-calls" className="rounded-lg border border-slate-800 bg-slate-950 p-3 lg:col-span-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Administrative line · {state.metrics.adminRouted} handled by Call Assist
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {state.callQueue.filter((call) => call.discipline === "admin").length === 0 ? (
              <li className="text-slate-500">No administrative calls in this moment.</li>
            ) : (
              state.callQueue
                .filter((call) => call.discipline === "admin")
                .map((call) => <li key={call.id}>{call.summary}</li>)
            )}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            System health normal · {state.metrics.callsLast30Minutes} calls in the last 30 minutes on the opening board
          </p>
        </section>

        <section data-demo-target="incident-history" className="rounded-lg border border-slate-800 bg-slate-950 p-3 lg:col-span-12">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Incident history</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {state.closedIncidents.length === 0 ? (
              <li className="text-sm text-slate-500">Closed incidents show up here for QA and after-action review.</li>
            ) : (
              state.closedIncidents.map((incident) => (
                <li key={incident.id} className="rounded-md border border-slate-800 p-2 text-sm">
                  <span className="font-medium">{incident.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">{locationLabel(incident.locationId)}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
