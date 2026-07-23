"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIVE_PIPELINE_STAGES,
  LOST_REASONS,
  PIPELINE_STAGES,
  STAGE_CONFIG,
  type LeadVertical,
  type PipelineStage,
  type SalesLeadCrmRecord,
} from "rapid-cortex-shared";
import { LeadDetailPanel } from "./lead-detail-panel";
import {
  getAttributionSummary,
  getPipelineData,
  type PipelineData,
  updateLeadStage,
} from "./leads-api";
import {
  formatCurrency,
  formatShortDate,
  leadAgency,
  leadDisplayName,
  matchesSearch,
  matchesSourceFilter,
  matchesVerticalFilter,
  type SourceFilter,
  type VerticalFilter,
  verticalLabel,
} from "./leads-utils";
import { PipelineBoard } from "./pipeline-board";

const PIPELINE_QUERY_KEY = ["rc-admin-leads-pipeline"] as const;
const ATTR_QUERY_KEY = ["rc-admin-leads-attribution"] as const;

type ViewMode = "board" | "list";
type ListSortKey = "name" | "agency" | "stage" | "vertical" | "value" | "next" | "updated";

function emptyStages(): Record<PipelineStage, SalesLeadCrmRecord[]> {
  return {
    NEW: [],
    CONTACTED: [],
    QUALIFIED: [],
    DISCOVERY: [],
    PROPOSAL: [],
    NEGOTIATION: [],
    PILOT: [],
    WON: [],
    LOST: [],
  };
}

function filterStages(
  stages: Record<PipelineStage, SalesLeadCrmRecord[]>,
  search: string,
  source: SourceFilter,
  vertical: VerticalFilter,
): Record<PipelineStage, SalesLeadCrmRecord[]> {
  const next = emptyStages();
  for (const stage of PIPELINE_STAGES) {
    next[stage] = (stages[stage] ?? []).filter(
      (l) =>
        matchesSearch(l, search) &&
        matchesSourceFilter(l, source) &&
        matchesVerticalFilter(l, vertical),
    );
  }
  return next;
}

function StageChangeModal({
  lead,
  targetStage,
  onClose,
  onConfirm,
  busy,
  error,
}: {
  lead: SalesLeadCrmRecord;
  targetStage: PipelineStage | null;
  onClose: () => void;
  onConfirm: (opts: {
    stage: PipelineStage;
    note?: string;
    lostReason?: string;
    pilotStartDate?: string;
  }) => void;
  busy: boolean;
  error: string | null;
}) {
  const [stage, setStage] = useState<PipelineStage>(targetStage ?? lead.pipelineStage);
  const [note, setNote] = useState("");
  const [lostReason, setLostReason] = useState(lead.lostReason ?? "");
  const [pilotStartDate, setPilotStartDate] = useState(lead.pilotStartDate?.slice(0, 10) ?? "");

  useEffect(() => {
    if (targetStage) setStage(targetStage);
  }, [targetStage]);

  const lostRequired = stage === "LOST" && !lostReason.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Move Stage</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="flex items-center justify-center gap-3 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 font-bold ${STAGE_CONFIG[lead.pipelineStage].bgClass} ${STAGE_CONFIG[lead.pipelineStage].textClass}`}
            >
              {STAGE_CONFIG[lead.pipelineStage].label}
            </span>
            <span className="text-slate-500">→</span>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as PipelineStage)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_CONFIG[s].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-slate-500">
              Reason {stage === "LOST" ? "(required)" : "(optional)"}
            </label>
            {stage === "LOST" ? (
              <select
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
              >
                <option value="">Select lost reason…</option>
                {LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note about this stage change…"
                className="w-full resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
            )}
          </div>

          {stage === "PILOT" && (
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Pilot start date</label>
              <input
                type="date"
                value={pilotStartDate}
                onChange={(e) => setPilotStartDate(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
              />
            </div>
          )}

          {stage === "LOST" && (
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional additional note…"
              className="w-full resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || lostRequired || stage === lead.pipelineStage}
            onClick={() =>
              onConfirm({
                stage,
                note: note.trim() || undefined,
                lostReason: stage === "LOST" ? lostReason : undefined,
                pilotStartDate: stage === "PILOT" ? pilotStartDate || undefined : undefined,
              })
            }
            className="rounded bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "Moving…" : `Move to ${STAGE_CONFIG[stage].label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadsListView({
  leads,
  selectedLeadId,
  onSelect,
}: {
  leads: SalesLeadCrmRecord[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<ListSortKey>("updated");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...leads];
    copy.sort((a, b) => {
      let av = "";
      let bv = "";
      switch (sortKey) {
        case "name":
          av = leadDisplayName(a).toLowerCase();
          bv = leadDisplayName(b).toLowerCase();
          break;
        case "agency":
          av = leadAgency(a).toLowerCase();
          bv = leadAgency(b).toLowerCase();
          break;
        case "stage":
          av = a.pipelineStage;
          bv = b.pipelineStage;
          break;
        case "vertical":
          av = a.vertical ?? "";
          bv = b.vertical ?? "";
          break;
        case "value":
          return sortAsc
            ? (a.estimatedValue ?? 0) - (b.estimatedValue ?? 0)
            : (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0);
        case "next":
          av = a.nextAction ?? "";
          bv = b.nextAction ?? "";
          break;
        default:
          av = a.updatedAt ?? a.createdAt;
          bv = b.updatedAt ?? b.createdAt;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [leads, sortAsc, sortKey]);

  function toggleSort(key: ListSortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const th = (key: ListSortKey, label: string) => (
    <th className="px-3 py-2 text-left">
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-300"
      >
        {label}
        {sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="flex-1 overflow-auto p-3.5">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead className="sticky top-0 bg-slate-950/95">
          <tr className="border-b border-slate-800">
            {th("name", "Name / Email")}
            {th("agency", "Agency")}
            {th("stage", "Stage")}
            {th("vertical", "Vertical")}
            {th("value", "Est. Value")}
            {th("next", "Next Action")}
            {th("updated", "Updated")}
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Assigned
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead) => (
            <tr
              key={lead.leadId}
              onClick={() => onSelect(lead.leadId)}
              className={[
                "cursor-pointer border-b border-slate-900/80 hover:bg-slate-900/60",
                selectedLeadId === lead.leadId ? "bg-sky-950/40" : "",
              ].join(" ")}
            >
              <td className="px-3 py-2">
                <div className="text-xs font-medium text-slate-100">{leadDisplayName(lead)}</div>
                <div className="text-[10px] text-slate-500">{lead.email}</div>
              </td>
              <td className="px-3 py-2 text-xs text-slate-400">{leadAgency(lead) || "—"}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${STAGE_CONFIG[lead.pipelineStage].bgClass} ${STAGE_CONFIG[lead.pipelineStage].textClass}`}
                >
                  {STAGE_CONFIG[lead.pipelineStage].label}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-slate-400">{verticalLabel(lead.vertical)}</td>
              <td className="px-3 py-2 text-xs text-slate-400">
                {formatCurrency(lead.estimatedValue)}
              </td>
              <td className="max-w-[160px] truncate px-3 py-2 text-xs text-amber-400/80">
                {lead.nextAction || "—"}
              </td>
              <td className="px-3 py-2 text-[11px] text-slate-500">
                {formatShortDate(lead.updatedAt ?? lead.createdAt)}
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {lead.assignedToName ?? lead.assignedTo ?? lead.assignee ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-600">No leads match the current filters.</p>
      )}
    </div>
  );
}

export function LeadsCrmPage() {
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [verticalFilter, setVerticalFilter] = useState<VerticalFilter>("all");
  const [view, setView] = useState<ViewMode>("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageModal, setStageModal] = useState<{
    leadId: string;
    targetStage: PipelineStage | null;
  } | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [focusNoteToken, setFocusNoteToken] = useState(0);

  const pipelineQ = useQuery({
    queryKey: PIPELINE_QUERY_KEY,
    queryFn: getPipelineData,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  const attrQ = useQuery({
    queryKey: ATTR_QUERY_KEY,
    queryFn: getAttributionSummary,
    staleTime: 60_000,
  });

  const stages = pipelineQ.data?.stages ?? emptyStages();
  const metrics = pipelineQ.data?.metrics;
  const filtered = useMemo(
    () => filterStages(stages, search, sourceFilter, verticalFilter),
    [stages, search, sourceFilter, verticalFilter],
  );

  const allFiltered = useMemo(
    () => PIPELINE_STAGES.flatMap((s) => filtered[s] ?? []),
    [filtered],
  );

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return allFiltered.find((l) => l.leadId === selectedId)
      ?? PIPELINE_STAGES.flatMap((s) => stages[s] ?? []).find((l) => l.leadId === selectedId)
      ?? null;
  }, [allFiltered, selectedId, stages]);

  const patchCacheLead = useCallback(
    (updated: SalesLeadCrmRecord) => {
      qc.setQueryData<PipelineData>(PIPELINE_QUERY_KEY, (prev) => {
        if (!prev) return prev;
        const nextStages = emptyStages();
        for (const stage of PIPELINE_STAGES) {
          nextStages[stage] = (prev.stages[stage] ?? [])
            .filter((l) => l.leadId !== updated.leadId)
            .map((l) => l);
        }
        const target = updated.pipelineStage;
        nextStages[target] = [...(nextStages[target] ?? []), updated];
        return { ...prev, stages: nextStages };
      });
    },
    [qc],
  );

  const stageMutation = useMutation({
    mutationFn: async (args: {
      leadId: string;
      stage: PipelineStage;
      note?: string;
      lostReason?: string;
      pilotStartDate?: string;
    }) =>
      updateLeadStage(args.leadId, args.stage, args.note, args.lostReason, args.pilotStartDate),
    onSuccess: (updated) => {
      patchCacheLead(updated);
      void qc.invalidateQueries({ queryKey: PIPELINE_QUERY_KEY });
      setStageModal(null);
      setStageError(null);
    },
    onError: (err) => setStageError((err as Error).message),
  });

  function requestStageMove(leadId: string, toStage: PipelineStage) {
    const from =
      PIPELINE_STAGES.flatMap((s) => stages[s] ?? []).find((l) => l.leadId === leadId)
        ?.pipelineStage;
    if (!from || from === toStage) return;
    // Always open modal for LOST/PILOT/WON or when dropping; for active→active still confirm
    setStageError(null);
    setStageModal({ leadId, targetStage: toStage });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || tag === "select" || (e.target as HTMLElement)?.isContentEditable;

      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (stageModal) {
          setStageModal(null);
          return;
        }
        if (selectedId) {
          setSelectedId(null);
          return;
        }
      }
      if (typing) return;
      if (e.key.toLowerCase() === "n" && selectedId) {
        e.preventDefault();
        setFocusNoteToken((t) => t + 1);
      }
      if (e.key.toLowerCase() === "m" && selectedId) {
        e.preventDefault();
        setStageModal({ leadId: selectedId, targetStage: null });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, stageModal]);

  const modalLead = stageModal
    ? PIPELINE_STAGES.flatMap((s) => stages[s] ?? []).find((l) => l.leadId === stageModal.leadId)
    : null;

  const sourceChips: { id: SourceFilter; label: string }[] = [
    { id: "all", label: "All Sources" },
    { id: "ring_waitlist", label: "Ring Waitlist" },
    { id: "contact_sales", label: "Contact Sales" },
    { id: "inside_the_cortex", label: "Inside the Cortex" },
  ];

  return (
    <div className="-mx-1 flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border border-slate-800 bg-[#060c1a]">
      {/* Metrics */}
      <div className="flex flex-wrap items-center gap-0 border-b border-slate-800 bg-[#0c1428] px-4 py-2.5">
        <Metric value={String(metrics?.total ?? 0)} label="TOTAL LEADS" color="text-sky-400" />
        <Metric
          value={formatCurrency(metrics?.totalPipelineValue ?? 0)}
          label="PIPELINE VALUE"
          color="text-emerald-400"
        />
        <Metric
          value={String(metrics?.activeDeals ?? 0)}
          label="ACTIVE DEALS"
          color="text-amber-400"
        />
        <Metric value={`${metrics?.winRate ?? 0}%`} label="WIN RATE" color="text-violet-400" />
        <Metric
          value={metrics?.avgDaysToClose == null ? "—" : String(metrics.avgDaysToClose)}
          label="AVG DAYS TO CLOSE"
          color="text-slate-400"
        />
        <div className="ml-auto flex items-center gap-2">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1 text-center">
            <div className="text-sm font-bold text-emerald-400">{stages.WON?.length ?? 0}</div>
            <div className="text-[9px] tracking-wide text-emerald-300/80">WON</div>
          </div>
          <div className="rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-1 text-center">
            <div className="text-sm font-bold text-red-400">{stages.LOST?.length ?? 0}</div>
            <div className="text-[9px] tracking-wide text-red-300/80">LOST</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-800 bg-[#0a1428] px-4 py-2">
        <div className="relative max-w-[280px] flex-1">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
            🔍
          </span>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads, agencies, emails…"
            className="w-full rounded border border-slate-800 bg-slate-950 py-1.5 pl-7 pr-2 text-xs text-slate-200 outline-none focus:border-sky-500"
          />
        </div>
        {sourceChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setSourceFilter(chip.id)}
            className={[
              "rounded-full border px-2.5 py-1 text-[11px]",
              sourceFilter === chip.id
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-slate-800 text-slate-500 hover:border-slate-600",
            ].join(" ")}
          >
            {chip.label}
          </button>
        ))}
        <select
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value as VerticalFilter)}
          className="rounded-full border border-slate-800 bg-transparent px-2.5 py-1 text-[11px] text-slate-400"
        >
          <option value="all">All Verticals</option>
          {(["rc911", "campus", "venue", "hospital", "transit", "unknown"] as LeadVertical[]).map(
            (v) => (
              <option key={v} value={v}>
                {verticalLabel(v)}
              </option>
            ),
          )}
        </select>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            title="Board view"
            onClick={() => setView("board")}
            className={[
              "rounded border px-2.5 py-1 text-xs",
              view === "board"
                ? "border-sky-500 bg-sky-500/15 text-sky-300"
                : "border-slate-800 text-slate-500",
            ].join(" ")}
          >
            ⊞
          </button>
          <button
            type="button"
            title="List view"
            onClick={() => setView("list")}
            className={[
              "rounded border px-2.5 py-1 text-xs",
              view === "list"
                ? "border-sky-500 bg-sky-500/15 text-sky-300"
                : "border-slate-800 text-slate-500",
            ].join(" ")}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {pipelineQ.isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            Loading pipeline…
          </div>
        ) : pipelineQ.isError ? (
          <div className="flex flex-1 items-center justify-center text-sm text-red-400">
            {(pipelineQ.error as Error).message}
          </div>
        ) : allFiltered.length === 0 && !search && sourceFilter === "all" && verticalFilter === "all" ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
            No leads yet. Leads from Contact Sales and Ring Waitlist will appear here.
          </div>
        ) : view === "board" ? (
          <PipelineBoard
            stages={filtered}
            selectedLeadId={selectedId}
            onSelect={setSelectedId}
            onDragStart={() => undefined}
            onDropLead={requestStageMove}
          />
        ) : (
          <LeadsListView
            leads={allFiltered.filter(
              (l) =>
                ACTIVE_PIPELINE_STAGES.includes(l.pipelineStage) ||
                l.pipelineStage === "WON" ||
                l.pipelineStage === "LOST",
            )}
            selectedLeadId={selectedId}
            onSelect={setSelectedId}
          />
        )}

        {selected && (
          <LeadDetailPanel
            lead={selected}
            attributionSummary={attrQ.data}
            onClose={() => setSelectedId(null)}
            onLeadUpdated={patchCacheLead}
            onOpenStageModal={() => {
              setStageError(null);
              setStageModal({ leadId: selected.leadId, targetStage: null });
            }}
            focusNoteToken={focusNoteToken}
            activityTabToken={0}
          />
        )}
      </div>

      {stageModal && modalLead && (
        <StageChangeModal
          lead={modalLead}
          targetStage={stageModal.targetStage}
          busy={stageMutation.isPending}
          error={stageError}
          onClose={() => {
            setStageModal(null);
            setStageError(null);
          }}
          onConfirm={(opts) => {
            stageMutation.mutate({ leadId: modalLead.leadId, ...opts });
          }}
        />
      )}
    </div>
  );
}

function Metric({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="border-r border-slate-800 px-5 py-1 first:pl-0 last:border-r-0">
      <div className={`text-xl font-bold leading-none ${color}`}>{value}</div>
      <div className="mt-0.5 text-[10px] tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
