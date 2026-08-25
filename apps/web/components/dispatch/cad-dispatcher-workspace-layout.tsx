"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AIAnalysis, AggregateConfidence, ConfidenceAnalysis, Incident, TranscriptSegment } from "rapid-cortex-shared";
import { SlaStatusBar } from "@/components/dashboards/sla-status-bar";
import { DispatcherIncidentWorkstationBody, DispatcherIncidentMapPanel } from "@/components/dispatch/dispatcher-incident-panel-grid";
import { DispatcherQueueTable } from "@/components/dispatch/dispatcher-queue-table";
import { WorkstationPanel } from "@/components/dispatch/workstation-panel";
import {
  startHorizontalResize,
  useWorkstationPrefs,
} from "@/lib/dispatcher/workstation-prefs";
import { ConfidenceMiniBar } from "@/components/confidence/confidence-mini-bar";
import { IncidentTimelineStrip } from "@/components/dispatch/incident-timeline-strip";
import { CadReadyPanel } from "@/components/dashboards/dispatcher-workspace-panels";
import { NonEmergencyQueuePanel } from "@/components/triage/non-emergency-queue-panel";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured, fetchTriage } from "@/lib/api";
import {
  fetchCadUnitBoard,
  formatEta,
  formatStatusTimer,
  mergeUnitBoard,
  UNIT_STATUS_LABEL,
  unitsFromCadRecords,
  unitsFromIncidents,
  type UnitBoardStatus,
} from "@/lib/dispatcher/unit-board";
import { formatRelativeOpened } from "@/lib/format";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { TriageBadge } from "@/components/triage/triage-badge";
import { isFieldConfidenceEnabled, isNonEmergencyTriageEnabled, isRcsEnabled } from "@/lib/runtime-flags";
import { canManageRcsCall, canViewRcsMonitor } from "@/lib/rcs/rcs-authz";
import { RcsSilentMonitorTrigger } from "@/components/rcs/RcsSilentMonitorTrigger";
import { EscalationInbox } from "@/components/dispatcher/escalation-inbox";
import { PreCallRmsContext } from "@/components/dispatcher/pre-call-rms-context";
import { useRegisterDispatcherModuleRail } from "@/components/dispatch/dispatcher-module-rail-context";

const CAD = {
  bg: "var(--rc-workstation-bg)",
  panel: "var(--rc-panel-bg)",
  border: "var(--rc-border)",
  text: "var(--rc-text)",
  muted: "var(--rc-text-muted)",
  p1: "var(--p1-color)",
  p2: "var(--p2-color)",
  p3: "var(--p3-color)",
  avail: "var(--rc-green)",
  busy: "var(--rc-red)",
  enroute: "var(--rc-amber)",
  onscene: "var(--rc-blue)",
  offduty: "var(--rc-text-muted)",
} as const;

function priorityFromUrgency(u: Incident["urgency"]): { label: string; color: string } {
  if (u === "critical") return { label: "P1", color: CAD.p1 };
  if (u === "high") return { label: "P2", color: CAD.p2 };
  return { label: "P3", color: CAD.p3 };
}

function unitDotColor(s: UnitBoardStatus): string {
  switch (s) {
    case "AVAILABLE":
      return "var(--rc-green)";
    case "ON_SCENE":
      return "var(--rc-blue)";
    case "OFF_DUTY":
      return "var(--rc-text-dim)";
    default:
      return "var(--rc-amber)";
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
    "ws-toolbar-btn inline-flex shrink-0 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500";
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
  const clock = useLiveClock();
  void clock;
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
  const elapsed = elapsedSince(incident.createdAt);
  const priClass = pr.label === "P1" ? "p1" : pr.label === "P2" ? "p2" : "p3";

  return (
    <div
      className="shrink-0 border-b px-3 py-2"
      style={{ borderColor: CAD.border, background: CAD.panel }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-tight" style={{ color: CAD.text }}>
              INC #{incident.incidentId}
            </span>
            <span className={`ws-priority ${priClass}`}>{pr.label}</span>
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
            <dd className="font-mono text-base font-bold tabular-nums" style={{ color: "var(--rc-red)" }}>
              {elapsed}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-wide">Callback</dt>
            <dd style={{ color: "var(--rc-text)" }}>—</dd>
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
  analysisError,
  analysisLoading,
  isRefreshingAi,
  onRefreshAi,
  languageBar,
  queueEmptyHint,
  createIncidentAction,
  showDdbQueuePanel = false,
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
  showChannelMonitor?: boolean;
  showSharePanel: boolean;
  shareOwnerAgencyId: string | undefined;
  analysisError: string | null;
  analysisLoading: boolean;
  isRefreshingAi: boolean;
  onRefreshAi: (() => void) | undefined;
  languageBar: ReactNode;
  queueEmptyHint?: string;
  createIncidentAction?: ReactNode;
  /** When true, swap the 3-column workspace for the DDB non-emergency queue panel. */
  showDdbQueuePanel?: boolean;
}) {
  const to = useJurisdictionLink();
  const clock = useLiveClock();
  const shift = useShiftElapsedLabel();
  const { user } = useSession();

  const activeTable = useMemo(() => queueIncidents.filter((i) => i.status === "active"), [queueIncidents]);
  const pendingTable = useMemo(
    () => queueIncidents.filter((i) => i.status !== "active" && i.status !== "archived"),
    [queueIncidents],
  );

  const apiLive = isApiConfigured();
  const prefs = useWorkstationPrefs();
  useRegisterDispatcherModuleRail(prefs.dock, prefs.openDockModule);

  const cadUnitsQuery = useQuery({
    queryKey: ["cad-units"],
    queryFn: fetchCadUnitBoard,
    enabled: apiLive,
    refetchInterval: 15_000,
    retry: false,
  });

  const unitBoard = useMemo(() => {
    const fromIncidents = unitsFromIncidents(queueIncidents);
    const fromCad = unitsFromCadRecords(cadUnitsQuery.data ?? [], queueIncidents);
    return mergeUnitBoard(fromCad, fromIncidents);
  }, [queueIncidents, cadUnitsQuery.data]);

  const unitBoardSource =
    (cadUnitsQuery.data?.length ?? 0) > 0 ? "CAD" : unitBoard.length > 0 ? "LIVE" : null;

  const cadEntryHref = incidentForUi
    ? `${to("/cad")}?incident=${encodeURIComponent(incidentForUi.incidentId)}`
    : to("/cad");

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash === "cad-transcript") prefs.openDockModule("transcript");
      if (hash === "cad-intelligence") prefs.openDockModule("incident_picture");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [prefs.openDockModule]);

  const p1 = queueIncidents.filter((i) => i.urgency === "critical").length;
  const p2 = queueIncidents.filter((i) => i.urgency === "high").length;
  const p3 = queueIncidents.length - p1 - p2;

  return (
    <div className="dispatcher-workspace flex h-full min-h-0 w-full flex-col overflow-hidden" style={{ background: "var(--rc-workstation-bg)", color: "var(--rc-text)" }}>
      <EscalationInbox agencyId={user?.agencyId} />
      {incidentForUi ? (
        <div className="shrink-0 px-2 pt-1">
          <PreCallRmsContext
            address={incidentForUi.callerAddressLine ?? incidentForUi.cadLocation}
            phone={incidentForUi.callerCallback}
          />
        </div>
      ) : null}
      {trainingBanner}
      {liveEmptyBanner}
      {loadErrorBanner}

      <header className="ws-toolbar shrink-0">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {createIncidentAction ?? (
            <CadActionBarButton href={to("/command")} title="Open command workspace">
              + New incident
            </CadActionBarButton>
          )}
          <CadActionBarButton onClick={() => prefs.openDockModule("transcript")} title="Focus transcript">
            Take call
          </CadActionBarButton>
          <span className="ws-toolbar-sep" aria-hidden />
          <CadActionBarButton href={cadEntryHref} title="CAD entry — assign units and nature code">
            CAD entry
          </CadActionBarButton>
          <CadActionBarButton onClick={() => prefs.openDockModule("incident_picture")} title="Review AI / BOLO context">
            BOLO
          </CadActionBarButton>
          <CadActionBarButton href={cadEntryHref} title="Assign units on the selected incident (CAD entry)">
            Unit status
          </CadActionBarButton>
          <span className="ws-toolbar-sep" aria-hidden />
          <CadActionBarButton onClick={() => prefs.openDockModule("incident_picture")} title="Notifications & intelligence">
            Notifications
          </CadActionBarButton>
          {isRcsEnabled() && user && canViewRcsMonitor(user, user.agencyId) ? (
            <>
              {canManageRcsCall(user, user.agencyId) && (selectedIdForPanels || incidentForUi?.incidentId) ? (
                <RcsSilentMonitorTrigger
                  key={selectedIdForPanels ?? incidentForUi?.incidentId ?? "rcs-idle"}
                  user={user}
                  compact
                  incidentId={selectedIdForPanels ?? incidentForUi?.incidentId ?? undefined}
                  callerPhone={incidentForUi?.callerCallback ?? undefined}
                  notes={incidentForUi?.title ? `Incident: ${incidentForUi.title}` : undefined}
                />
              ) : null}
              <CadActionBarButton href={to("/rcs")} title="Response Continuity Monitor">
                RCS Monitor
              </CadActionBarButton>
            </>
          ) : null}
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

      <div className="border-b px-3 py-1.5" style={{ borderColor: CAD.border, background: CAD.panel }}>
        <SlaStatusBar />
      </div>

      {showDdbQueuePanel ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4" style={{ background: CAD.bg }}>
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onQueueTabChange("all")}
              className="rounded border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide"
              style={{ borderColor: CAD.border, color: CAD.muted, background: CAD.panel }}
            >
              ← All incidents
            </button>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: CAD.muted }}>
              Non-emergency queue (DDB)
            </span>
          </div>
          <NonEmergencyQueuePanel enabled />
        </div>
      ) : (
      <div
        className="dispatcher-cad-body min-h-0 flex-1"
        data-max={prefs.maximized ?? ""}
        style={{
          gridTemplateColumns:
            prefs.maximized === "map"
              ? "0px 0px 0px 0px minmax(0, 1fr)"
              : `${prefs.queueWidth}px 4px minmax(0, 1fr) 4px ${prefs.contextWidth}px`,
        }}
      >
        <div className="flex min-h-0 flex-col overflow-hidden" style={{ background: "var(--rc-panel-bg)", borderRight: "1px solid var(--rc-border)" }}>
          <div className="ws-panel-header secondary shrink-0">
            Unit board
            <span className="ml-auto font-mono text-[9px]">
              {unitBoardSource ? `${unitBoardSource} · ` : null}
              {unitBoard.length} units
            </span>
          </div>
          <div className="max-h-[28%] min-h-[72px] overflow-y-auto border-b" style={{ borderColor: "var(--rc-border)" }}>
            {unitBoard.length === 0 ? (
              <p className="px-2 py-2 font-mono text-[10px] leading-relaxed text-[var(--rc-text-muted)]">
                No units on live calls. Select an incident, open <span className="text-[var(--rc-text)]">CAD entry</span>,
                add unit IDs, and save. CAD unit feed (when connected) updates this board automatically.
              </p>
            ) : (
              unitBoard.map((u) => {
                const selected = Boolean(u.incidentId && u.incidentId === selectedId);
                return (
                  <button
                    key={`${u.source}-${u.id}`}
                    type="button"
                    className={`ws-unit-row w-full text-left ${selected ? "selected" : ""}`}
                    title={u.incidentId ? "Open assigned incident" : undefined}
                    onClick={() => {
                      if (u.incidentId) onSelectIncident(u.incidentId);
                    }}
                  >
                    <span className="truncate font-bold">{u.id}</span>
                    <span className="flex items-center gap-1.5 truncate text-[11px] text-[var(--rc-text-muted)]">
                      <span className="status-dot" style={{ background: unitDotColor(u.status) }} />
                      {UNIT_STATUS_LABEL[u.status]}
                    </span>
                    <span className="truncate tabular-nums text-[var(--rc-text-muted)]">{u.beat}</span>
                    <span className="tabular-nums text-[var(--rc-text-muted)]">{formatEta(u.etaSeconds)}</span>
                    <span className="tabular-nums text-[var(--rc-text-muted)]">
                      {formatStatusTimer(u.updatedAt, clock.getTime())}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="ws-panel-header secondary shrink-0">
            Queue
            <span className="ml-auto font-mono text-[9px]">
              P1:{p1} P2:{p2} P3:{p3}
            </span>
          </div>
          {showNonEmergencyTabs ? (
            <div className="flex shrink-0 border-b" style={{ borderColor: "var(--rc-border)" }}>
              <button
                type="button"
                onClick={() => onQueueTabChange("all")}
                className="flex-1 border-r px-2 py-1 font-mono text-[10px] font-bold uppercase"
                style={{
                  borderColor: "var(--rc-border)",
                  background: queueTab === "all" ? "var(--rc-panel-selected)" : "transparent",
                  color: queueTab === "all" ? "var(--rc-text)" : "var(--rc-text-muted)",
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onQueueTabChange("non_emergency")}
                className="flex-1 px-2 py-1 font-mono text-[10px] font-bold uppercase"
                style={{
                  background: queueTab === "non_emergency" ? "var(--rc-panel-selected)" : "transparent",
                  color: queueTab === "non_emergency" ? "var(--rc-text)" : "var(--rc-text-muted)",
                }}
              >
                Non-emergency
              </button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DispatcherQueueTable
              incidents={queueIncidents}
              selectedId={selectedId}
              onSelect={onSelectIncident}
              isLoading={incidentsLoading}
              emptyHint={queueEmptyHint}
              selectedFieldConfidenceAggregate={
                isFieldConfidenceEnabled() ? fieldConfidenceAggregate : null
              }
            />
          </div>
        </div>

        <div
          className="ws-resize-x hidden lg:block"
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => startHorizontalResize(e.clientX, prefs.queueWidth, false, prefs.setQueueWidth)}
        />

        <div id="cad-center" className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="incident-workspace min-h-0 flex-1" style={{ gridTemplateRows: "auto minmax(0, 1fr)" }}>
            <div className="shrink-0">
              <CadActiveIncidentCard
                incident={incidentForUi}
                analysis={analysisForUi}
                fieldConfidenceAggregate={fieldConfidenceAggregate}
              />
              <IncidentTimelineStrip incident={incidentForUi ?? undefined} segments={transcriptSegments} analysis={analysisForUi ?? undefined} />
            </div>
            <DispatcherIncidentWorkstationBody
              incidentId={selectedIdForPanels}
              incident={incidentForUi}
              analysis={analysisForUi}
              fieldConfidence={fieldConfidenceForUi}
              fieldConfidenceLoading={fieldConfidenceLoading}
              analysisError={analysisError}
              analysisLoading={analysisLoading}
              isRefreshingAi={isRefreshingAi}
              onRefreshAi={onRefreshAi}
              showCallerCard={showCallerCard}
              transcriptSegments={transcriptSegments}
              transcriptToolbar={transcriptToolbar}
              transcriptAutoScroll={transcriptAutoScroll}
              onTranscriptAutoScrollChange={onTranscriptAutoScrollChange}
              transcriptStreaming={transcriptStreaming}
              transcriptLoading={detailLoading && transcriptLoading}
              collapsed={prefs.collapsed}
              maximized={prefs.maximized}
              onToggleCollapse={prefs.toggleCollapsed}
              onToggleMaximize={prefs.toggleMaximize}
              languageBar={languageBar}
              dock={prefs.dock}
              onToggleDockSplit={prefs.toggleDockSplit}
              onSwapDockSlots={prefs.swapDockSlots}
              onFocusDockSlot={prefs.focusDockSlot}
              onCloseDockSlot={prefs.closeDockSlot}
            />
          </div>
        </div>

        <div
          className="ws-resize-x hidden lg:block"
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => startHorizontalResize(e.clientX, prefs.contextWidth, true, prefs.setContextWidth)}
        />

        <div className="flex min-h-0 flex-col overflow-hidden" style={{ background: "var(--rc-panel-bg)", borderLeft: "1px solid var(--rc-border)" }}>
          <WorkstationPanel
            name="map"
            title="Map"
            collapsed={prefs.collapsed.map}
            maximized={prefs.maximized === "map"}
            onToggleCollapse={() => prefs.toggleCollapsed("map")}
            onToggleMaximize={() => prefs.toggleMaximize("map")}
            bodyClassName="!p-0 min-h-[220px] h-[280px]"
          >
            <DispatcherIncidentMapPanel incidentId={selectedIdForPanels} incident={incidentForUi} />
          </WorkstationPanel>
          <div className="shrink-0 border-b p-2" style={{ borderColor: "var(--rc-border)" }}>
            <CadReadyPanel incident={incidentForUi} />
          </div>
          <div className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden">
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
      )}
    </div>
  );
}
