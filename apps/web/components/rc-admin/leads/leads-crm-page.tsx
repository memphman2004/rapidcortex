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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0d1b35] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
          <h2 className="text-sm font-bold text-slate-100">Move Stage</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#334155] transition hover:text-slate-300"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            {PIPELINE_STAGES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                className={[
                  "rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
                  stage === s
                    ? `${STAGE_CONFIG[s].bgClass} ${STAGE_CONFIG[s].textClass} border-transparent`
                    : "border-[rgba(255,255,255,0.06)] text-slate-500 hover:border-[rgba(255,255,255,0.12)]",
                ].join(" ")}
              >
                {STAGE_CONFIG[s].label}
              </button>
            ))}
          </div>

          {stage === "LOST" && (
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-600">
                Reason <span className="text-red-400">*</span>
              </label>
              <select
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#080f1e] px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              >
                <option value="">Select reason…</option>
                {LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {stage === "PILOT" && (
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-600">
                Pilot Start Date
              </label>
              <input
                type="date"
                value={pilotStartDate}
                onChange={(e) => setPilotStartDate(e.target.value)}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#080f1e] px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-600">
              Note (optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for moving…"
              className="w-full resize-none rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#080f1e] px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
            />
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 transition hover:text-slate-300"
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
                lostReason: stage === "LOST" ? lostReason || undefined : undefined,
                pilotStartDate: stage === "PILOT" ? pilotStartDate || undefined : undefined,
              })
            }
            className="rounded-lg bg-sky-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-40"
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
    <th className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600 first:pl-5 last:pr-5">
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="hover:text-slate-300"
      >
        {label}
        {sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.06)]">
      <table className="w-full min-w-[700px] border-collapse">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628]">
            {th("name", "Name / Email")}
            {th("agency", "Agency")}
            {th("stage", "Stage")}
            {th("vertical", "Vertical")}
            {th("value", "Est. Value")}
            {th("next", "Next Action")}
            {th("updated", "Updated")}
            <th className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600">
              Assigned
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead) => {
            const selected = selectedLeadId === lead.leadId;
            return (
              <tr
                key={lead.leadId}
                onClick={() => onSelect(lead.leadId)}
                className={[
                  "cursor-pointer border-b border-[rgba(255,255,255,0.03)] transition-colors",
                  selected ? "bg-sky-500/5" : "hover:bg-[rgba(255,255,255,0.02)]",
                ].join(" ")}
              >
                <td className="px-5 py-3 text-xs first:pl-5 last:pr-5">
                  <div className="font-medium text-slate-100">{leadDisplayName(lead)}</div>
                  <div className="text-[10px] text-slate-500">{lead.email}</div>
                </td>
                <td className="px-5 py-3 text-xs text-slate-400">{leadAgency(lead) || "—"}</td>
                <td className="px-5 py-3 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${STAGE_CONFIG[lead.pipelineStage].bgClass} ${STAGE_CONFIG[lead.pipelineStage].textClass}`}
                  >
                    {STAGE_CONFIG[lead.pipelineStage].label}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-slate-400">{verticalLabel(lead.vertical)}</td>
                <td className="px-5 py-3 text-xs text-slate-400">
                  {formatCurrency(lead.estimatedValue)}
                </td>
                <td className="max-w-[160px] truncate px-5 py-3 text-xs text-amber-400/80">
                  {lead.nextAction || "—"}
                </td>
                <td className="px-5 py-3 text-[11px] text-slate-500">
                  {formatShortDate(lead.updatedAt ?? lead.createdAt)}
                </td>
                <td className="px-5 py-3 text-xs text-slate-500">
                  {lead.assignedToName ?? lead.assignedTo ?? lead.assignee ?? "—"}
                </td>
              </tr>
            );
          })}
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
    return (
      allFiltered.find((l) => l.leadId === selectedId) ??
      PIPELINE_STAGES.flatMap((s) => stages[s] ?? []).find((l) => l.leadId === selectedId) ??
      null
    );
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
    const from = PIPELINE_STAGES.flatMap((s) => stages[s] ?? []).find(
      (l) => l.leadId === leadId,
    )?.pipelineStage;
    if (!from || from === toStage) return;
    setStageError(null);
    setStageModal({ leadId, targetStage: toStage });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (e.target as HTMLElement)?.isContentEditable;

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
    <div className="flex min-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#050c1a]">
      <div className="flex flex-wrap items-stretch gap-2 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 py-3">
        <Metric
          value={String(metrics?.total ?? 0)}
          label="Total Leads"
          color="text-sky-400"
          icon="◎"
        />
        <Metric
          value={formatCurrency(metrics?.totalPipelineValue ?? 0)}
          label="Pipeline Value"
          color="text-emerald-400"
          icon="$"
        />
        <Metric
          value={String(metrics?.activeDeals ?? 0)}
          label="Active Deals"
          color="text-amber-400"
          icon="⚡"
        />
        <Metric
          value={`${metrics?.winRate ?? 0}%`}
          label="Win Rate"
          color="text-violet-400"
          icon="✓"
        />
        <Metric
          value={metrics?.avgDaysToClose == null ? "—" : `${metrics.avgDaysToClose}d`}
          label="Avg to Close"
          color="text-slate-500"
          icon="◷"
        />
        <div className="ml-auto flex items-stretch gap-2">
          <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-2">
            <span className="text-xl font-extrabold leading-none text-emerald-400">
              {stages.WON?.length ?? 0}
            </span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600">
              Won
            </span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-2">
            <span className="text-xl font-extrabold leading-none text-red-400">
              {stages.LOST?.length ?? 0}
            </span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-red-600">
              Lost
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 py-2.5">
        <div className="relative min-w-[240px] max-w-[300px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#334155]">
            🔍
          </span>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads, agencies, emails…"
            className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#080f1e] py-2 pl-8 pr-3 text-xs text-slate-200 placeholder-[#334155] outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
          />
        </div>
        {sourceChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setSourceFilter(chip.id)}
            className={[
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
              sourceFilter === chip.id
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-[rgba(255,255,255,0.06)] text-slate-600 hover:border-[rgba(255,255,255,0.12)] hover:text-slate-400",
            ].join(" ")}
          >
            {chip.label}
          </button>
        ))}
        <select
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value as VerticalFilter)}
          className="rounded-full border border-[rgba(255,255,255,0.06)] bg-transparent px-3 py-1.5 text-[11px] text-slate-600 outline-none focus:border-sky-500"
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
        <div className="ml-auto flex rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#080f1e] p-0.5">
          {(["board", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                "rounded-md px-3 py-1.5 text-[11px] font-semibold transition",
                view === v ? "bg-sky-500/15 text-sky-300" : "text-[#334155] hover:text-slate-400",
              ].join(" ")}
            >
              {v === "board" ? "⊞ Board" : "☰ List"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden bg-[#050c1a]">
        {pipelineQ.isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2.5 text-sm text-slate-600">
            <span className="animate-spin text-sky-500/60">↻</span>
            Loading pipeline…
          </div>
        ) : pipelineQ.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] px-10 py-8">
              <div className="mb-2 text-4xl opacity-30">⚠</div>
              <div className="mb-1 text-sm font-semibold text-red-400">Pipeline failed to load</div>
              <div className="mb-5 max-w-[260px] text-xs text-slate-600">
                {(pipelineQ.error as Error).message}
              </div>
              <button
                type="button"
                onClick={() => void pipelineQ.refetch()}
                className="rounded-lg border border-sky-500/30 bg-sky-500/8 px-5 py-2 text-xs font-bold text-sky-300 transition hover:bg-sky-500/15"
              >
                ↻ Try again
              </button>
            </div>
          </div>
        ) : allFiltered.length === 0 &&
          !search &&
          sourceFilter === "all" &&
          verticalFilter === "all" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="text-5xl opacity-[0.05]">◎</div>
            <div className="text-sm font-semibold text-slate-400">Pipeline is empty</div>
            <div className="max-w-[260px] text-xs text-slate-600">
              Leads from Contact Sales, Ring Waitlist, and Inside the Cortex appear here
              automatically.
            </div>
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
  icon,
}: {
  value: string;
  label: string;
  color: string;
  icon: string;
}) {
  return (
    <div className="flex min-w-[110px] flex-col gap-1 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d1b35] px-4 py-3">
      <div className="flex items-baseline gap-1.5">
        <span className={`text-[12px] opacity-50 ${color}`}>{icon}</span>
        <span
          className={`text-2xl font-extrabold leading-none tracking-tight tabular-nums ${color}`}
        >
          {value}
        </span>
      </div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{label}</div>
    </div>
  );
}
