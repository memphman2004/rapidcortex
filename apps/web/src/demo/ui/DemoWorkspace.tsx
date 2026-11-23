"use client";

import { useState } from "react";
import { CategoryBadge } from "@/components/dispatch/badges";
import { TranscriptPanel } from "@/components/dispatch/transcript-panel";
import { locationLabel } from "../fixtures/locations";
import { usePlaybackEngine } from "../hooks/useDemoEngine";
import type { DemoIncident } from "../types";
import type { TranscriptSegment } from "rapid-cortex-shared";
import { formatDemoClock } from "./format";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Status dot color matching real unit board colors */
function unitDotStyle(status: string): string {
  if (status === "available") return "var(--rc-green)";
  if (status === "on_scene") return "var(--rc-blue)";
  if (status === "cleared") return "var(--rc-text-muted)";
  return "var(--rc-amber)";
}

/** Map demo unit status to dispatcher board label */
function unitStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    available: "AVAILABLE",
    dispatched: "DISPATCHED",
    en_route: "EN ROUTE",
    on_scene: "ON SCENE",
    transporting: "TRANSPORT",
    cleared: "CLEARED",
  };
  return labels[status] ?? status.toUpperCase().replace("_", " ");
}

/** Priority badge matching real P1/P2/P3 */
function PriBadge({ discipline }: { discipline: string }) {
  const isEmergency = discipline !== "admin";
  // ems/medical and fire are P1; law is P2; admin is P3
  const isCritical = discipline === "medical" || discipline === "fire" || discipline === "ems";
  const label = isCritical ? "P1" : isEmergency ? "P2" : "P3";
  const cls = isCritical ? "p1" : isEmergency ? "p2" : "p3";
  return <span className={`ws-priority ${cls}`}>{label}</span>;
}

// ─── Section header matching dispatcher ws-panel-header ───────────────────────

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="ws-panel-header secondary shrink-0">
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  const onShift = state.dispatchers.filter((d) => d.onShift);

  return (
    <div
      className="dispatcher-shell dispatcher-workspace flex h-[calc(100vh-2.25rem)] flex-col overflow-hidden"
      style={{ background: "var(--rc-workstation-bg)", color: "var(--rc-text)" }}
    >
      {/* ── Top toolbar ──────────────────────────────────────────────────── */}
      <header
        data-demo-target="dispatcher-view"
        className="ws-toolbar shrink-0 !border-b flex-col !h-auto !px-4 !py-2 gap-0"
        style={{ borderBottom: "1px solid var(--rc-border)" }}
      >
        {/* Row 1: Agency + clock */}
        <div className="flex w-full items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--rc-blue)" }}>
              Maplewood County Communications Center
            </div>
            <div className="flex items-baseline gap-3 mt-0.5">
              <h1 className="text-base font-semibold leading-none" style={{ color: "var(--rc-text)" }}>
                {snapshot.displayName ?? "Demo"}
              </h1>
              <span className="font-mono text-sm font-bold tabular-nums"
                style={{ color: "var(--rc-text)" }}>
                {state.clockLabel}
              </span>
              <span className="font-mono text-[10px]" style={{ color: "var(--rc-text-muted)" }}>
                Scenario {formatDemoClock(snapshot.offsetSeconds)}
              </span>
            </div>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--rc-text-muted)" }}>
              Fictional combined PSAP · {state.agency.populationServed.toLocaleString()} residents ·{" "}
              {state.agency.cadDescription}
            </p>
          </div>

          {/* System status badge */}
          <div className="flex shrink-0 items-center gap-3">
            {state.coverageGap && (
              <span className="font-mono text-[10px] font-bold uppercase rounded border px-2 py-0.5"
                style={{ color: "var(--rc-red)", borderColor: "var(--rc-red)", background: "var(--rc-red-dim)" }}>
                ⚠ Coverage Gap
              </span>
            )}
            {state.activeIncidents.some((i) => i.mci || i.major) && (
              <span className="font-mono text-[10px] font-bold uppercase rounded border px-2 py-0.5"
                style={{ color: "var(--rc-red)", borderColor: "var(--rc-red)", background: "var(--rc-red-dim)" }}>
                MCI / MAJOR
              </span>
            )}
            <span
              className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
              style={{
                borderColor: "color-mix(in srgb, var(--rc-amber) 50%, transparent)",
                color: "var(--rc-amber)",
                background: "var(--rc-amber-dim)",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--rc-amber)" }} />
              Demo
            </span>
          </div>
        </div>

        {/* Row 2: Dispatcher position pills */}
        <div className="flex flex-wrap gap-1.5 mt-2 w-full">
          {onShift.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px]"
              style={{
                borderColor: "var(--rc-border-strong)",
                background: "var(--rc-panel-bg)",
              }}
            >
              <span style={{ color: "var(--rc-text-muted)" }}>
                {d.position ? `Pos ${d.position}` : "Supervisor"}
                {d.remote ? " · remote" : ""}
              </span>
              <span className="font-semibold" style={{ color: "var(--rc-text)" }}>
                {d.name}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* ── 3-column body ────────────────────────────────────────────────── */}
      <div
        className="dispatcher-cad-body min-h-0 flex-1"
        style={{
          display: "grid",
          gridTemplateColumns: "240px minmax(0,1fr) 300px",
          gridTemplateRows: "minmax(0,1fr)",
        }}
      >
        {/* ── LEFT: Unit board + Call queue ──────────────────────────────── */}
        <div
          className="flex min-h-0 flex-col overflow-hidden"
          style={{
            background: "var(--rc-panel-bg)",
            borderRight: "1px solid var(--rc-border)",
          }}
        >
          {/* Unit board */}
          <PanelHeader>
            <span>Unit board</span>
            <span className="ml-auto font-mono text-[9px]">
              {state.units.length} units
            </span>
          </PanelHeader>
          <div
            className="overflow-y-auto border-b"
            style={{
              maxHeight: "35%",
              minHeight: "72px",
              borderColor: "var(--rc-border)",
            }}
          >
            {state.units.length === 0 ? (
              <p className="px-2 py-2 font-mono text-[10px]" style={{ color: "var(--rc-text-muted)" }}>
                No units on board.
              </p>
            ) : (
              state.units.map((unit) => (
                <div
                  key={unit.id}
                  data-demo-target="unit-board"
                  className="ws-unit-row"
                >
                  {/* col 1: unit id */}
                  <span className="truncate font-bold">{unit.id}</span>
                  {/* col 2: status */}
                  <span className="flex items-center gap-1.5 truncate"
                    style={{ color: "var(--rc-text-muted)" }}>
                    <span
                      className="status-dot shrink-0"
                      style={{ background: unitDotStyle(unit.status) }}
                    />
                    {unitStatusLabel(unit.status)}
                  </span>
                  {/* col 3-5: type + agency (span remaining) */}
                  <span className="col-span-3 truncate"
                    style={{ color: "var(--rc-text-muted)" }}>
                    {unit.type}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Call queue */}
          <PanelHeader>
            <span>Call queue</span>
            <span className="ml-auto font-mono text-[9px]" style={{ color: "var(--rc-text-muted)" }}>
              {state.metrics.queueDepth} holding
            </span>
          </PanelHeader>
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            data-demo-target="incoming-call"
          >
            {state.callQueue.length === 0 ? (
              <p className="px-3 py-3 font-mono text-[11px]" style={{ color: "var(--rc-text-muted)" }}>
                No calls holding.
              </p>
            ) : (
              state.callQueue.map((call) => (
                <div
                  key={call.id}
                  className="border-b px-3 py-2.5 cursor-pointer hover:bg-[var(--rc-panel-selected)] transition-colors"
                  style={{ borderColor: "var(--rc-border)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <PriBadge discipline={call.discipline ?? "unknown"} />
                      <span className="font-medium text-[12px] truncate"
                        style={{ color: "var(--rc-text)" }}>
                        {call.summary}
                      </span>
                    </div>
                    <span
                      className="shrink-0 font-mono text-[9px] uppercase font-bold rounded px-1 py-0.5"
                      style={{
                        color: call.status === "queued" ? "var(--rc-red)" : "var(--rc-text-muted)",
                        borderColor: call.status === "queued" ? "var(--rc-red-border)" : "var(--rc-border)",
                        border: "1px solid",
                        background: call.status === "queued" ? "var(--rc-red-dim)" : "transparent",
                      }}
                    >
                      {call.status === "queued" ? "QUEUED" : call.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] mt-1" style={{ color: "var(--rc-text-muted)" }}>
                    {locationLabel(call.locationId)}
                  </p>
                  <p className="font-mono text-[10px]" style={{ color: "var(--rc-text-muted)" }}>
                    {call.phone}
                  </p>
                  {call.repeatCaller && (
                    <p className="mt-1 font-mono text-[10px] font-semibold"
                      style={{ color: "var(--rc-amber)" }}>
                      ↻ Repeat location
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── CENTER: Active incident + Transcript + Assist + Translation ── */}
        <div
          className="flex min-h-0 flex-col overflow-hidden"
          style={{ background: "var(--rc-workstation-bg)", borderRight: "1px solid var(--rc-border)" }}
        >
          {/* Active incident card */}
          {focus && (
            <div
              className="shrink-0 border-b px-4 py-2.5"
              style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriBadge discipline={focus.discipline} />
                    <CategoryBadge value={categoryFor(focus)} />
                    <span className="font-mono text-[10px] font-bold"
                      style={{ color: "var(--rc-text-muted)" }}>
                      INC #{focus.id}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-snug mt-1"
                    style={{ color: "var(--rc-text)" }}>
                    {focus.title}
                  </p>
                  <p className="font-mono text-[10px]" style={{ color: "var(--rc-text-muted)" }}>
                    {locationLabel(focus.locationId)}
                  </p>
                  {focus.units.length > 0 && (
                    <p className="font-mono text-[10px]" style={{ color: "var(--rc-text-muted)" }}>
                      Units: {focus.units.join(", ")}
                    </p>
                  )}
                </div>
                <dl className="shrink-0 text-right font-mono">
                  <dt className="text-[9px] uppercase tracking-wide" style={{ color: "var(--rc-text-muted)" }}>
                    Elapsed
                  </dt>
                  <dd className="text-lg font-bold tabular-nums"
                    style={{ color: "var(--rc-red)" }}>
                    {formatDemoClock(snapshot.offsetSeconds)}
                  </dd>
                </dl>
              </div>
              {focus.commandNotes.length > 0 && (
                <p className="mt-1.5 font-mono text-[11px]" style={{ color: "var(--rc-amber)" }}>
                  ▶ {focus.commandNotes[focus.commandNotes.length - 1]}
                </p>
              )}
            </div>
          )}

          {/* Transcript */}
          <div
            className="min-h-0 flex-1 overflow-hidden"
            data-demo-target="transcript"
          >
            {focus ? (
              <TranscriptPanel
                segments={toSegments(focus)}
                autoScroll={autoScroll}
                onAutoScrollChange={setAutoScroll}
                isStreaming={snapshot.status === "playing"}
                isLoading={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="font-mono text-[11px]" style={{ color: "var(--rc-text-muted)" }}>
                  Select an incident or start a scenario to see the transcript.
                </p>
              </div>
            )}
          </div>

          {/* Call Assist + Translation row */}
          <div
            className="shrink-0 grid grid-cols-2 gap-0 border-t"
            style={{ borderColor: "var(--rc-border)" }}
          >
            {/* Call Assist */}
            <div
              className="border-r p-3"
              data-demo-target="call-assist"
              style={{
                borderColor: "var(--rc-border)",
                background: "var(--rc-blue-dim)",
              }}
            >
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--rc-blue)" }}>
                Call Assist
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed"
                style={{ color: "var(--rc-text)" }}>
                {assist}
              </p>
            </div>

            {/* Translation */}
            <div
              className="p-3"
              data-demo-target="translation"
              style={{ background: "var(--rc-panel-bg)" }}
            >
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--rc-text-muted)" }}>
                RC Translate
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed"
                style={{ color: translation ? "var(--rc-text)" : "var(--rc-text-muted)" }}>
                {translation
                  ? `${translation.language.toUpperCase()} · ${translation.note}`
                  : "No translation on focused call. Spanish, French, Creole, and Somali appear here automatically."}
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Supervisor + Admin + Incident history ───────────────── */}
        <div
          className="flex min-h-0 flex-col overflow-hidden"
          style={{ background: "var(--rc-panel-bg)" }}
        >
          {/* Supervisor */}
          <PanelHeader>
            <span>Supervisor</span>
            <span className="ml-auto font-mono text-[9px]"
              style={{ color: "var(--rc-text-muted)" }}>
              {state.activeIncidents.length} active
            </span>
          </PanelHeader>
          <div
            data-demo-target="supervisor-dashboard"
            className="overflow-y-auto border-b p-2 space-y-1.5"
            style={{
              maxHeight: "38%",
              minHeight: "80px",
              borderColor: "var(--rc-border)",
            }}
          >
            {state.activeIncidents.length === 0 ? (
              <p className="font-mono text-[10px] p-1" style={{ color: "var(--rc-text-muted)" }}>
                No active incidents.
              </p>
            ) : (
              state.activeIncidents.map((incident) => (
                <article
                  key={incident.id}
                  className="rounded border p-2 text-[11px]"
                  style={{
                    borderColor: "var(--rc-border-strong)",
                    background: "var(--rc-workstation-bg)",
                  }}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <CategoryBadge value={categoryFor(incident)} />
                    <span className="font-medium leading-snug"
                      style={{ color: "var(--rc-text)" }}>
                      {incident.title}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px]"
                    style={{ color: "var(--rc-text-muted)" }}>
                    {locationLabel(incident.locationId)}
                  </p>
                  {incident.units.length > 0 && (
                    <p className="font-mono text-[10px]"
                      style={{ color: "var(--rc-text-muted)" }}>
                      Units {incident.units.join(", ")}
                    </p>
                  )}
                  {incident.commandNotes.length > 0 && (
                    <p className="mt-1 font-mono text-[10px] font-semibold"
                      style={{ color: "var(--rc-amber)" }}>
                      {incident.commandNotes[incident.commandNotes.length - 1]}
                    </p>
                  )}
                </article>
              ))
            )}
            {state.alerts.length > 0 && (
              <p className="mt-1 font-mono text-[10px] font-semibold p-1"
                style={{ color: "var(--rc-amber)" }}>
                ⚠ {state.alerts[state.alerts.length - 1]?.message}
              </p>
            )}
            {state.shiftSummary && (
              <p className="font-mono text-[10px] p-1" style={{ color: "var(--rc-text)" }}>
                {state.shiftSummary}
              </p>
            )}
            {state.mutualAid.length > 0 && (
              <p className="font-mono text-[10px] p-1" style={{ color: "var(--rc-text-muted)" }}>
                Mutual aid: {state.mutualAid[state.mutualAid.length - 1]}
              </p>
            )}
          </div>

          {/* Admin line */}
          <PanelHeader>
            <span>Administrative line</span>
            <span className="ml-auto font-mono text-[9px]"
              style={{ color: "var(--rc-text-muted)" }}>
              {state.metrics.adminRouted} handled by Call Assist
            </span>
          </PanelHeader>
          <div
            data-demo-target="admin-calls"
            className="overflow-y-auto border-b px-3 py-2 space-y-1"
            style={{
              maxHeight: "20%",
              minHeight: "56px",
              borderColor: "var(--rc-border)",
            }}
          >
            {state.callQueue.filter((c) => c.discipline === "admin").length === 0 ? (
              <p className="font-mono text-[10px]" style={{ color: "var(--rc-text-muted)" }}>
                No administrative calls in this moment.
              </p>
            ) : (
              state.callQueue
                .filter((c) => c.discipline === "admin")
                .map((c) => (
                  <p key={c.id} className="font-mono text-[10px]" style={{ color: "var(--rc-text)" }}>
                    {c.summary}
                  </p>
                ))
            )}
            <p className="font-mono text-[9px] pt-1" style={{ color: "var(--rc-text-muted)" }}>
              System health normal · {state.metrics.callsLast30Minutes} calls in the last 30 minutes
            </p>
          </div>

          {/* Incident history */}
          <PanelHeader>
            <span>Incident history</span>
            <span className="ml-auto font-mono text-[9px]"
              style={{ color: "var(--rc-text-muted)" }}>
              {state.closedIncidents.length} closed
            </span>
          </PanelHeader>
          <div
            data-demo-target="incident-history"
            className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5 space-y-1"
          >
            {state.closedIncidents.length === 0 ? (
              <p className="font-mono text-[10px] px-1" style={{ color: "var(--rc-text-muted)" }}>
                Closed incidents show up here for QA and after-action review.
              </p>
            ) : (
              state.closedIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded border px-2 py-1.5"
                  style={{
                    borderColor: "var(--rc-border)",
                    background: "var(--rc-workstation-bg)",
                  }}
                >
                  <span className="font-mono text-[11px] font-medium"
                    style={{ color: "var(--rc-text)" }}>
                    {incident.title}
                  </span>
                  <p className="font-mono text-[10px] mt-0.5"
                    style={{ color: "var(--rc-text-muted)" }}>
                    {locationLabel(incident.locationId)}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Continuity log */}
          {focus && (
            <>
              <PanelHeader>
                <span>Continuity log</span>
              </PanelHeader>
              <div
                data-demo-target="continuity-log"
                className="overflow-y-auto px-3 py-2 space-y-0.5"
                style={{ maxHeight: "20%", minHeight: "48px" }}
              >
                {(focus.continuity.length
                  ? focus.continuity
                  : ["The log fills itself as the incident moves."]
                ).map((entry, i) => (
                  <p
                    key={i}
                    className="font-mono text-[10px]"
                    style={{ color: "var(--rc-text)" }}
                  >
                    {entry}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
