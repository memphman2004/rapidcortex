"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AIAnalysis, AggregateConfidence, ConfidenceAnalysis, Incident, TranscriptSegment } from "rapid-cortex-shared";
import { AiRecommendationPanel } from "@/components/dispatch/ai-panel";
import { ConfidenceMiniBar } from "@/components/confidence/confidence-mini-bar";
import { CallerCardPanel } from "@/components/dispatch/caller-card-panel";
import { IncidentJurisdictionSharePanel } from "@/components/dispatch/incident-jurisdiction-share-panel";
import { IncidentQueue } from "@/components/dispatch/incident-queue";
import { IncidentTimelineStrip } from "@/components/dispatch/incident-timeline-strip";
import { TranscriptChunkPlayer } from "@/components/dispatch/transcript-chunk-player";
import { TranscriptPanel } from "@/components/dispatch/transcript-panel";
import { DispatchActionPanel } from "@/components/dispatch/dispatch-action-panel";
import { ManualModeButton } from "@/components/dashboards/dispatcher-workspace-panels";
import { SupervisorAssistPanel } from "@/components/dashboards/dispatcher-workspace-panels";
import { CadReadyPanel } from "@/components/dashboards/dispatcher-workspace-panels";
import { isApiConfigured, fetchTriage } from "@/lib/api";
import { formatRelativeOpened } from "@/lib/format";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { TriageBadge } from "@/components/triage/triage-badge";
import { isFieldConfidenceEnabled, isNonEmergencyTriageEnabled } from "@/lib/runtime-flags";

const CAD = {
  bg: "#0a0f1a",
  panel: "#111827",
  border: "#1f2937",
  text: "#f9fafb",
  muted: "#6b7280",
  p1: "#ef4444",
  p2: "#f59e0b",
  p3: "#3b82f6",
  avail: "#10b981",
  busy: "#ef4444",
  enroute: "#f97316",
  onscene: "#3b82f6",
  offduty: "#6b7280",
} as const;

type UnitRow = { id: string; status: keyof typeof unitStatusLabel; beat: string; updated: string };

const unitStatusLabel = {
  AVAILABLE: "AVAILABLE",
  BUSY: "BUSY",
  EN_ROUTE: "EN ROUTE",
  ON_SCENE: "ON SCENE",
  OFF_DUTY: "OFF DUTY",
} as const;

const DEMO_UNITS: UnitRow[] = [
  { id: "101", status: "AVAILABLE", beat: "4A", updated: "00:12" },
  { id: "204", status: "EN_ROUTE", beat: "2C", updated: "01:03" },
  { id: "312", status: "ON_SCENE", beat: "7B", updated: "03:41" },
  { id: "415", status: "BUSY", beat: "1D", updated: "00:45" },
  { id: "502", status: "OFF_DUTY", beat: "—", updated: "—" },
];

function priorityFromUrgency(u: Incident["urgency"]): { label: string; color: string } {
  if (u === "critical") return { label: "P1", color: CAD.p1 };
  if (u === "high") return { label: "P2", color: CAD.p2 };
  return { label: "P3", color: CAD.p3 };
}

function unitBadgeColor(s: UnitRow["status"]): string {
  switch (s) {
    case "AVAILABLE":
      return CAD.avail;
    case "BUSY":
      return CAD.busy;
    case "EN_ROUTE":
      return CAD.enroute;
    case "ON_SCENE":
      return CAD.onscene;
    default:
      return CAD.offduty;
  }
}

function incidentStatusTone(status: Incident["status"]): string {
  switch (status) {
    case "active":
      return CAD.p2;
    case "in_progress":
      return CAD.enroute;
    case "completed":
      return CAD.avail;
    default:
      return CAD.muted;
  }
}

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function useShiftElapsedLabel() {
  const [start] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [start]);
  const sec = elapsedSec;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function elapsedSince(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function CadActionBarButton({
  children,
  href,
  onClick,
  title,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  title?: string;
}) {
  const cls =
    "inline-flex shrink-0 items-center justify-center rounded border border-[#1f2937] bg-[#111827] px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#f9fafb] hover:border-[#374151] hover:bg-[#1f2937] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500";
  if (href) {
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} title={title}>
      {children}
    </button>
  );
}

function CadActiveIncidentCard({
  incident,
  analysis,
  fieldConfidenceAggregate,
}: {
  incident: Incident | null;
  analysis: AIAnalysis | null;
  fieldConfidenceAggregate?: AggregateConfidence | null;
}) {
  const triageEnabled = Boolean(incident) && isNonEmergencyTriageEnabled() && isApiConfigured();
  const triageQuery = useQuery({
    queryKey: ["triage", incident?.incidentId ?? "none"],
    queryFn: () => fetchTriage(incident!.incidentId),
    enabled: triageEnabled,
    refetchInterval: 10_000,
  });

  if (!incident) {
    return (
      <div
        className="shrink-0 border-b px-3 py-3"
        style={{ borderColor: CAD.border, background: CAD.panel }}
      >
        <p className="font-mono text-xs" style={{ color: CAD.muted }}>
          Select an incident from the queue.
        </p>
      </div>
    );
  }
  const pr = priorityFromUrgency(analysis?.urgency ?? incident.urgency);

  return (
    <div
      className="shrink-0 border-b px-3 py-3"
      style={{ borderColor: CAD.border, background: CAD.panel }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-tight" style={{ color: CAD.text }}>
              CAD #{incident.incidentId}
            </span>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
              style={{ backgroundColor: `${pr.color}22`, color: pr.color, border: `1px solid ${pr.color}55` }}
            >
              {pr.label}
            </span>
            {triageEnabled ? (
              <TriageBadge
                incidentId={incident.incidentId}
                result={triageQuery.data ?? null}
                isAnalyzing={triageQuery.isLoading}
                onOverrideSuccess={() => void triageQuery.refetch()}
              />
            ) : null}
          </div>
          <p className="text-sm font-medium leading-snug" style={{ color: CAD.text }}>
            {incident.title}
          </p>
          <p className="font-mono text-xs" style={{ color: CAD.muted }}>
            {incident.category.replace(/_/g, " ")} · {incident.callerAddressLine?.trim() || "Location pending"}
          </p>
          {isFieldConfidenceEnabled() && fieldConfidenceAggregate ? (
            <div className="pt-1">
              <ConfidenceMiniBar aggregate={fieldConfidenceAggregate} />
            </div>
          ) : null}
        </div>
        <dl className="shrink-0 space-y-1 text-right font-mono text-[11px]" style={{ color: CAD.muted }}>
          <div>
            <dt className="text-[9px] uppercase tracking-wide">Elapsed</dt>
            <dd className="text-[#f9fafb]">{elapsedSince(incident.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-wide">Callback</dt>
            <dd className="text-[#f9fafb]">—</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function CadIncidentsTable({
  title,
  incidents,
  selectedId,
  onSelect,
  emptyHint,
}: {
  title: string;
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyHint?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-2 py-1.5" style={{ borderColor: CAD.border }}>
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: CAD.muted }}>
          {title}
        </h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {incidents.length === 0 ? (
          <p className="p-2 font-mono text-[11px]" style={{ color: CAD.muted }}>
            {emptyHint ?? "—"}
          </p>
        ) : (
          <table className="w-full border-collapse text-left font-mono text-[10px]">
            <thead>
              <tr style={{ color: CAD.muted }} className="border-b" data-border={CAD.border}>
                <th className="border-b px-1.5 py-1 font-semibold" style={{ borderColor: CAD.border }}>
                  CAD#
                </th>
                <th className="border-b px-1 py-1 font-semibold" style={{ borderColor: CAD.border }}>
                  Pri
                </th>
                <th className="border-b px-1 py-1 font-semibold" style={{ borderColor: CAD.border }}>
                  Type
                </th>
                <th className="border-b px-1 py-1 font-semibold" style={{ borderColor: CAD.border }}>
                  Loc
                </th>
                <th className="border-b px-1 py-1 font-semibold" style={{ borderColor: CAD.border }}>
                  T
                </th>
                <th className="border-b px-1 py-1 font-semibold" style={{ borderColor: CAD.border }}>
                  St
                </th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => {
                const pr = priorityFromUrgency(inc.urgency);
                const sel = inc.incidentId === selectedId;
                return (
                  <tr
                    key={inc.incidentId}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(inc.incidentId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(inc.incidentId);
                      }
                    }}
                    className="cursor-pointer border-b transition-colors"
                    style={{
                      borderColor: CAD.border,
                      background: sel ? "rgba(59,130,246,0.12)" : undefined,
                    }}
                  >
                    <td className="max-w-[4.5rem] truncate px-1.5 py-1 font-mono text-[10px]" style={{ color: CAD.text }}>
                      {inc.incidentId.slice(-8)}
                    </td>
                    <td className="px-1 py-1 font-bold" style={{ color: pr.color }}>
                      {pr.label}
                    </td>
                    <td className="max-w-[3.5rem] truncate px-1 py-1 capitalize" style={{ color: CAD.text }}>
                      {inc.category.replace(/_/g, " ")}
                    </td>
                    <td className="max-w-[4rem] truncate px-1 py-1" style={{ color: CAD.muted }} title={inc.callerAddressLine ?? ""}>
                      {(inc.callerAddressLine ?? "—").slice(0, 12)}
                    </td>
                    <td className="whitespace-nowrap px-1 py-1" style={{ color: CAD.muted }}>
                      {formatRelativeOpened(inc.updatedAt)}
                    </td>
                    <td className="px-1 py-1">
                      <span
                        className="inline-block rounded px-1 py-0.5 text-[9px] font-bold uppercase"
                        style={{
                          color: incidentStatusTone(inc.status),
                          border: `1px solid ${incidentStatusTone(inc.status)}66`,
                          background: `${incidentStatusTone(inc.status)}18`,
                        }}
                      >
                        {inc.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CadCollapsibleCadForm({ incident }: { incident: Incident | null }) {
  const [open, setOpen] = useState(true);
  const [nature, setNature] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!incident) return;
    setNature(incident.category.replace(/_/g, " "));
    setLocation(incident.callerAddressLine ?? "");
    setNotes("");
  }, [incident?.incidentId, incident]);

  return (
    <div className="shrink-0 border-t" style={{ borderColor: CAD.border, background: CAD.panel }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wide"
        style={{ color: CAD.text }}
      >
        <span>CAD entry</span>
        <span style={{ color: CAD.muted }}>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="space-y-2 border-t px-3 pb-3 pt-2" style={{ borderColor: CAD.border }}>
          <label className="block font-mono text-[9px] font-semibold uppercase" style={{ color: CAD.muted }}>
            Nature code
            <input
              value={nature}
              onChange={(e) => setNature(e.target.value)}
              disabled={!incident}
              className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-sky-500"
              style={{ borderColor: CAD.border, background: CAD.bg, color: CAD.text }}
            />
          </label>
          <label className="block font-mono text-[9px] font-semibold uppercase" style={{ color: CAD.muted }}>
            Location
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={!incident}
              className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-sky-500"
              style={{ borderColor: CAD.border, background: CAD.bg, color: CAD.text }}
            />
          </label>
          <label className="block font-mono text-[9px] font-semibold uppercase" style={{ color: CAD.muted }}>
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!incident}
              rows={3}
              className="mt-1 w-full resize-y rounded border px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-sky-500"
              style={{ borderColor: CAD.border, background: CAD.bg, color: CAD.text }}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function CadDispatcherWorkspaceLayout({
  trainingBanner,
  liveEmptyBanner,
  loadErrorBanner,
  incidentForUi,
  analysisForUi,
  fieldConfidenceForUi = null,
  fieldConfidenceLoading = false,
  fieldConfidenceAggregate = null,
  transcriptSegments,
  transcriptToolbar,
  transcriptAutoScroll,
  onTranscriptAutoScrollChange,
  transcriptStreaming,
  transcriptLoading,
  selectedId,
  queueIncidents,
  incidentsLoading,
  onSelectIncident,
  queueTab,
  onQueueTabChange,
  showNonEmergencyTabs,
  detailLoading,
  selectedIdForPanels,
  showCallerCard,
  showSharePanel,
  shareOwnerAgencyId,
  analysisError,
  analysisLoading,
  isRefreshingAi,
  onRefreshAi,
  languageBar,
  queueEmptyHint,
}: {
  trainingBanner: ReactNode;
  liveEmptyBanner: ReactNode;
  loadErrorBanner: ReactNode;
  incidentForUi: Incident | null;
  analysisForUi: AIAnalysis | null;
  fieldConfidenceForUi?: ConfidenceAnalysis | null;
  fieldConfidenceLoading?: boolean;
  fieldConfidenceAggregate?: AggregateConfidence | null;
  transcriptSegments: TranscriptSegment[];
  transcriptToolbar: ReactNode;
  transcriptAutoScroll: boolean;
  onTranscriptAutoScrollChange: (v: boolean) => void;
  transcriptStreaming: boolean;
  transcriptLoading: boolean;
  selectedId: string | null;
  queueIncidents: Incident[];
  incidentsLoading: boolean;
  onSelectIncident: (id: string) => void;
  queueTab: "all" | "non_emergency";
  onQueueTabChange: (tab: "all" | "non_emergency") => void;
  showNonEmergencyTabs: boolean;
  detailLoading: boolean;
  selectedIdForPanels: string | null;
  showCallerCard: boolean;
  showSharePanel: boolean;
  shareOwnerAgencyId: string | undefined;
  analysisError: string | null;
  analysisLoading: boolean;
  isRefreshingAi: boolean;
  onRefreshAi: (() => void) | undefined;
  languageBar: ReactNode;
  queueEmptyHint?: string;
}) {
  const to = useJurisdictionLink();
  const clock = useLiveClock();
  const shift = useShiftElapsedLabel();

  const activeTable = useMemo(() => queueIncidents.filter((i) => i.status === "active"), [queueIncidents]);
  const pendingTable = useMemo(
    () => queueIncidents.filter((i) => i.status !== "active" && i.status !== "archived"),
    [queueIncidents],
  );

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const apiLive = isApiConfigured();

  return (
    <div className="dispatcher-workspace flex h-full min-h-0 w-full flex-col" style={{ background: CAD.bg, color: CAD.text }}>
      {trainingBanner}
      {liveEmptyBanner}
      {loadErrorBanner}

      {/* Top action bar */}
      <header
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-2 py-1.5"
        style={{ borderColor: CAD.border, background: CAD.panel }}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <CadActionBarButton href={to("/command")} title="Open command workspace (⌘ shortcut TBD)">
            New incident
          </CadActionBarButton>
          <CadActionBarButton onClick={() => scrollTo("cad-transcript")} title="Scroll to live transcript">
            Take call
          </CadActionBarButton>
          <CadActionBarButton href={to("/cad")} title="CAD entry workspace">
            CAD entry
          </CadActionBarButton>
          <CadActionBarButton onClick={() => scrollTo("cad-intelligence")} title="Review AI / BOLO context">
            BOLO
          </CadActionBarButton>
          <CadActionBarButton href={to("/dispatcher")} title="Unit-centric dispatcher console">
            Unit status
          </CadActionBarButton>
          <CadActionBarButton onClick={() => scrollTo("cad-intelligence")} title="Notifications & intelligence">
            Notifications
          </CadActionBarButton>
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono text-[11px]" style={{ color: CAD.muted }}>
          <time dateTime={clock.toISOString()} className="tabular-nums" style={{ color: CAD.text }}>
            {clock.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </time>
          <span className="hidden sm:inline" title="Elapsed since this console was opened">
            Shift <span style={{ color: CAD.text }}>{shift}</span>
          </span>
          <span
            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase"
            style={{
              borderColor: apiLive ? `${CAD.avail}66` : `${CAD.p2}66`,
              color: apiLive ? CAD.avail : CAD.p2,
              background: apiLive ? `${CAD.avail}14` : `${CAD.p2}14`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: apiLive ? CAD.avail : CAD.p2 }} />
            {apiLive ? "System nominal" : "Training"}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 min-h-[20rem] flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left 25% — units + my queue */}
        <div
          className="flex h-[min(32vh,18rem)] shrink-0 flex-col border-b lg:h-auto lg:w-[25%] lg:min-w-[220px] lg:max-w-[320px] lg:shrink-0 lg:border-b-0 lg:border-r"
          style={{ borderColor: CAD.border, background: CAD.panel }}
        >
          <div className="border-b px-2 py-1.5" style={{ borderColor: CAD.border }}>
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: CAD.muted }}>
              Available units
            </h3>
          </div>
          <div className="max-h-40 overflow-y-auto border-b lg:max-h-none lg:flex-none" style={{ borderColor: CAD.border }}>
            <table className="w-full border-collapse font-mono text-[10px]">
              <thead>
                <tr style={{ color: CAD.muted }}>
                  <th className="border-b px-1.5 py-1 text-left font-semibold" style={{ borderColor: CAD.border }}>
                    Unit
                  </th>
                  <th className="border-b px-1 py-1 text-left font-semibold" style={{ borderColor: CAD.border }}>
                    Status
                  </th>
                  <th className="border-b px-1 py-1 text-left font-semibold" style={{ borderColor: CAD.border }}>
                    Beat
                  </th>
                  <th className="border-b px-1 py-1 text-left font-semibold" style={{ borderColor: CAD.border }}>
                    Upd
                  </th>
                </tr>
              </thead>
              <tbody>
                {DEMO_UNITS.map((u) => (
                  <tr key={u.id} className="border-b" style={{ borderColor: CAD.border }}>
                    <td className="px-1.5 py-1 font-mono font-bold" style={{ color: CAD.text }}>
                      {u.id}
                    </td>
                    <td className="px-1 py-1">
                      <span
                        className="inline-block rounded px-1 py-0.5 text-[8px] font-bold"
                        style={{
                          color: unitBadgeColor(u.status),
                          border: `1px solid ${unitBadgeColor(u.status)}55`,
                          background: `${unitBadgeColor(u.status)}12`,
                        }}
                      >
                        {unitStatusLabel[u.status]}
                      </span>
                    </td>
                    <td className="px-1 py-1 text-xs text-slate-300 tabular-nums">
                      {u.beat}
                    </td>
                    <td className="px-1 py-1 text-xs text-slate-300 tabular-nums">
                      {u.updated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showNonEmergencyTabs ? (
            <div className="flex border-b" style={{ borderColor: CAD.border }}>
              <button
                type="button"
                onClick={() => onQueueTabChange("all")}
                className="flex-1 px-2 py-1.5 font-mono text-[10px] font-bold uppercase"
                style={{
                  background: queueTab === "all" ? CAD.bg : "transparent",
                  color: queueTab === "all" ? CAD.text : CAD.muted,
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onQueueTabChange("non_emergency")}
                className="flex-1 px-2 py-1.5 font-mono text-[10px] font-bold uppercase"
                style={{
                  background: queueTab === "non_emergency" ? CAD.bg : "transparent",
                  color: queueTab === "non_emergency" ? CAD.text : CAD.muted,
                }}
              >
                Non-emergency
              </button>
            </div>
          ) : null}
          <IncidentQueue
            incidents={queueIncidents}
            selectedId={selectedId}
            onSelect={onSelectIncident}
            isLoading={incidentsLoading}
            compact
            emptyHint={queueEmptyHint}
            sectionTitle="My queue"
            outerClassName="flex min-h-0 min-h-0 flex-1 flex-col bg-transparent"
            selectedFieldConfidenceAggregate={
              isFieldConfidenceEnabled() ? fieldConfidenceAggregate : null
            }
          />
        </div>

        {/* Center 50% */}
        <div
          id="cad-center"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b lg:min-w-0 lg:max-w-none lg:flex-1 lg:border-b-0 lg:border-r"
          style={{ borderColor: CAD.border, background: CAD.bg }}
        >
          <CadActiveIncidentCard
            incident={incidentForUi}
            analysis={analysisForUi}
            fieldConfidenceAggregate={fieldConfidenceAggregate}
          />
          <div className="shrink-0 [&>div]:border-[#1f2937] [&>div]:bg-[#111827]">
            <IncidentTimelineStrip incident={incidentForUi ?? undefined} segments={transcriptSegments} analysis={analysisForUi ?? undefined} />
          </div>
          {languageBar}
          <div id="cad-transcript" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TranscriptPanel
              segments={transcriptSegments}
              autoScroll={transcriptAutoScroll}
              onAutoScrollChange={onTranscriptAutoScrollChange}
              isStreaming={transcriptStreaming}
              isLoading={detailLoading && transcriptLoading}
              toolbar={transcriptToolbar}
              className="!min-h-0 !flex-1 !border-r-0 !bg-[#111827] !border-b !border-[#1f2937]"
            />
          </div>
          {showCallerCard && selectedIdForPanels ? (
            <div className="shrink-0 border-b p-2" style={{ borderColor: CAD.border, background: CAD.panel }}>
              <CallerCardPanel incidentId={selectedIdForPanels} />
            </div>
          ) : null}
          {showSharePanel && selectedIdForPanels && shareOwnerAgencyId ? (
            <div className="shrink-0 border-b p-2" style={{ borderColor: CAD.border, background: CAD.panel }}>
              <IncidentJurisdictionSharePanel incidentId={selectedIdForPanels} ownerAgencyId={shareOwnerAgencyId} />
            </div>
          ) : null}
          <div id="cad-intelligence" className="min-h-0 shrink-0 overflow-y-auto border-b" style={{ borderColor: CAD.border, maxHeight: "min(42vh, 360px)" }}>
            <AiRecommendationPanel
              key={selectedIdForPanels ?? "none"}
              incidentId={selectedIdForPanels}
              incident={incidentForUi}
              analysis={analysisForUi}
              fieldConfidence={fieldConfidenceForUi}
              fieldConfidenceLoading={fieldConfidenceLoading}
              analysisError={analysisError}
              analysisLoading={analysisLoading}
              onRefresh={onRefreshAi}
              isRefreshing={isRefreshingAi}
              className="!w-full !max-w-none !border-0 !bg-transparent"
              showCadSuggestedBadge
            />
          </div>
          <CadCollapsibleCadForm incident={incidentForUi} />
          <div
            className="flex shrink-0 flex-wrap items-center gap-2 border-t px-2 py-2"
            style={{ borderColor: CAD.border, background: CAD.panel }}
          >
            <Link
              href={to("/admin/cad")}
              className="inline-flex items-center rounded border border-[#2563eb] bg-[#2563eb] px-3 py-1.5 font-mono text-[11px] font-bold uppercase text-white hover:bg-[#3b82f6]"
            >
              Submit to CAD
            </Link>
            <ManualModeButton />
            <button
              type="button"
              onClick={() => scrollTo("dispatch-actions")}
              className="inline-flex items-center rounded border border-[#1f2937] bg-[#111827] px-3 py-1.5 font-mono text-[11px] font-bold uppercase text-[#f9fafb] hover:border-amber-500/50 hover:text-amber-200"
            >
              Flag
            </button>
          </div>
          <div className="min-h-0 shrink-0 overflow-y-auto border-t p-2" style={{ borderColor: CAD.border, background: CAD.panel }}>
            <SupervisorAssistPanel />
          </div>
          <div id="dispatch-actions" className="min-h-0 shrink-0 overflow-y-auto border-t p-2" style={{ borderColor: CAD.border, background: CAD.panel }}>
            <DispatchActionPanel
              incidentId={selectedIdForPanels}
              incident={incidentForUi}
              analysis={analysisForUi}
              disabled={analysisLoading}
            />
          </div>
        </div>

        {/* Right 25% — incident queues only */}
        <div
          className="flex min-h-0 w-full flex-col overflow-hidden lg:w-[25%] lg:min-w-[240px] lg:max-w-[380px]"
          style={{ background: CAD.panel, borderColor: CAD.border }}
        >
          <div className="shrink-0 border-b p-2" style={{ borderColor: CAD.border }}>
            <CadReadyPanel incident={incidentForUi} />
          </div>
          <div className="grid min-h-0 min-h-[12rem] flex-1 grid-rows-2 gap-0 border-t lg:border-t-0" style={{ borderColor: CAD.border }}>
            <CadIncidentsTable
              title="Active incidents"
              incidents={activeTable.length ? activeTable : queueIncidents}
              selectedId={selectedId}
              onSelect={onSelectIncident}
              emptyHint="No active rows."
            />
            <CadIncidentsTable
              title="Pending"
              incidents={pendingTable}
              selectedId={selectedId}
              onSelect={onSelectIncident}
              emptyHint="None pending."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
