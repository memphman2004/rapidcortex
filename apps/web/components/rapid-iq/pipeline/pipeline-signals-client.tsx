"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type {
  RapidIqPipelineCreditToolStatus,
  RapidIqPipelineSignal,
  RapidIqPipelineSignalStatus,
  RapidIqProcurementStage,
  RapidIqProcurementStageFilterId,
} from "rapid-cortex-shared";
import {
  displayPipelineScores,
  matchesProcurementStageFilter,
  RAPID_IQ_PIPELINE_SOURCE_LABELS,
  resolveProcurementStage,
} from "rapid-cortex-shared";
import { DualScoreBadge } from "../dual-score-badge";
import { ProcurementStageBadge } from "../procurement-stage-badge";
import { ProcurementStageTabs } from "../procurement-stage-tabs";
import { SignalEvidenceBlock } from "../signal-evidence";
import {
  getPipelineCredits,
  getPipelineSignals,
  patchPipelineSignal,
  patchPipelineSignalStatus,
  PIPELINE_CREDITS_QUERY_KEY,
  PIPELINE_SIGNALS_QUERY_KEY,
  pushPipelineSignalToCrm,
} from "@/lib/rapid-iq/pipeline-api";
import { PipelineKanban } from "./pipeline-kanban";
import { SignalDetailPanel } from "./signal-detail-panel";

const STATUS_TABS: Array<{ value: RapidIqPipelineSignalStatus | "all" | "ready"; label: string }> = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "pushed", label: "Pushed to CRM" },
  { value: "dismissed", label: "Dismissed" },
];

function fitBadge(label: string): string {
  if (label === "high") return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
  if (label === "medium") return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
  return "bg-slate-700/60 text-slate-400 border border-slate-700";
}

function sourceBadge(sourceId: string): string {
  if (sourceId === "usa-spending") return "bg-sky-500/10 text-sky-400";
  if (sourceId === "sam-gov") return "bg-violet-500/10 text-violet-400";
  if (sourceId === "news-rss") return "bg-indigo-500/10 text-indigo-400";
  if (sourceId === "legistar-bulk") return "bg-orange-500/10 text-orange-400";
  if (sourceId === "socrata") return "bg-teal-500/10 text-teal-400";
  if (sourceId === "state-911-board") return "bg-rose-500/10 text-rose-400";
  if (sourceId === "state-arpa") return "bg-amber-500/10 text-amber-400";
  if (sourceId === "openlegislative") return "bg-cyan-500/10 text-cyan-400";
  if (sourceId === "county-procurement") return "bg-orange-600/10 text-orange-300";
  if (sourceId === "rapid-iq") return "bg-sky-600/15 text-sky-300";
  if (sourceId === "grants-gov") return "bg-emerald-500/10 text-emerald-400";
  if (sourceId === "911-gov" || sourceId === "fcc-reports") return "bg-rose-600/10 text-rose-300";
  if (sourceId === "trade-publication") return "bg-indigo-600/10 text-indigo-300";
  if (sourceId === "competitor-intel") return "bg-violet-500/15 text-violet-300";
  if (sourceId === "boarddocs" || sourceId === "civiclerk") return "bg-amber-500/10 text-amber-300";
  if (sourceId === "sourcewell-omnia") return "bg-teal-600/10 text-teal-300";
  if (sourceId === "university-procurement") return "bg-sky-500/10 text-sky-300";
  return "bg-slate-700/50 text-slate-400";
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function CreditMeter({
  label,
  status,
}: {
  label: string;
  status: RapidIqPipelineCreditToolStatus | undefined;
}) {
  if (!status) {
    return (
      <div className="min-w-[140px]">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
        <div className="text-xs text-slate-600 mt-0.5">—</div>
      </div>
    );
  }
  const pct = status.limit > 0 ? Math.min(100, (status.used / status.limit) * 100) : 0;
  const low = status.remaining < status.limit * 0.2;
  return (
    <div className="min-w-[160px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={`text-[10px] tabular-nums ${low ? "text-amber-400" : "text-slate-400"}`}>
          {status.remaining.toLocaleString()} left
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${low ? "bg-amber-500/80" : "bg-sky-600/80"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-500 tabular-nums">
        {status.used.toLocaleString()} / {status.limit.toLocaleString()}
        <span className="text-slate-600"> · </span>
        {status.cycleStart} → {status.cycleEnd}
      </div>
    </div>
  );
}

function SignalCard({
  signal,
  busy,
  selected,
  onOpen,
  onPushToCrm,
  onReview,
  onDismiss,
}: {
  signal: RapidIqPipelineSignal;
  busy: boolean;
  selected?: boolean;
  onOpen: () => void;
  onPushToCrm: () => void;
  onReview: () => void;
  onDismiss: () => void;
}) {
  const isPushed = signal.status === "pushed";
  const showActions = signal.status === "new" || signal.status === "reviewed" || isPushed;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={selected}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={[
        "w-full cursor-pointer text-left bg-slate-900 border rounded-lg p-4 transition-colors",
        selected
          ? "border-sky-500/60 bg-slate-800/80"
          : "border-slate-800 hover:border-slate-600 hover:bg-slate-800/60",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sourceBadge(signal.sourceId)}`}
            >
              {RAPID_IQ_PIPELINE_SOURCE_LABELS[signal.sourceId] ?? signal.sourceId}
            </span>
            <ProcurementStageBadge signal={signal} />
            {isPushed && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800">
                IN CRM
              </span>
            )}
            {signal.status === "dismissed" && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">
                DISMISSED
              </span>
            )}
            <span className="text-[11px] text-slate-500 ml-auto">{signal.signalDate}</span>
          </div>

          <p className="text-sm font-medium text-slate-200 leading-snug line-clamp-2 mb-2">
            {signal.rawTitle}
          </p>

          {signal.summary && (
            <p className="text-xs text-slate-400 line-clamp-2 mb-3">{signal.summary}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {signal.jurisdiction && (
              <span className="text-[10px] text-slate-400">
                {signal.jurisdiction}
                {signal.state ? `, ${signal.state}` : ""}
              </span>
            )}
            {signal.vendorNamed && (
              <span className="text-[10px] text-slate-400">{signal.vendorNamed}</span>
            )}
            {signal.fundingSource && (
              <span className="text-[10px] text-slate-400">{signal.fundingSource}</span>
            )}
            {signal.dollarAmount != null && (
              <span className="text-[10px] text-slate-400">{formatAmount(signal.dollarAmount)}</span>
            )}
            {signal.manualEntry && (
              <span className="text-[10px] font-semibold text-slate-400">Manual Entry</span>
            )}
          </div>
          <SignalEvidenceBlock signal={signal} />
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <DualScoreBadge
            intent={displayPipelineScores(signal).intent}
            fit={displayPipelineScores(signal).fit}
          />
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${fitBadge(signal.fitLabel)}`}
          >
            {signal.fitLabel}
          </span>
        </div>
      </div>

      {showActions && (
        <div className="pipeline-item-actions mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`btn-push-crm ${isPushed ? "in-crm" : ""}`}
            disabled={isPushed || busy}
            onClick={(e) => {
              e.stopPropagation();
              if (!isPushed) onPushToCrm();
            }}
          >
            {isPushed ? "✓ In CRM" : "Push to CRM"}
          </button>
          {!isPushed && (
            <>
              <button
                type="button"
                className="btn-review"
                disabled={busy || signal.status === "reviewed"}
                onClick={(e) => {
                  e.stopPropagation();
                  onReview();
                }}
              >
                Mark Reviewed
              </button>
              <button
                type="button"
                className="btn-dismiss"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  /** Fill the Rapid IQ workspace instead of a standalone page chrome. */
  embedded?: boolean;
  /** Pre-sliced signals for the active 911 / campus / venue / competitor tab. */
  items?: RapidIqPipelineSignal[];
  categoryLabel?: string;
};

export function PipelineSignalsClient({
  embedded = false,
  items: itemsProp,
  categoryLabel,
}: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<RapidIqPipelineSignalStatus | "all" | "ready">("all");
  const [stageFilter, setStageFilter] = useState<RapidIqProcurementStageFilterId>("all");
  const [selectedSignal, setSelectedSignal] = useState<RapidIqPipelineSignal | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const { data, isLoading, error } = useQuery({
    queryKey: [...PIPELINE_SIGNALS_QUERY_KEY, "standalone"],
    queryFn: () => getPipelineSignals(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled: itemsProp == null,
  });

  const creditsQuery = useQuery({
    queryKey: PIPELINE_CREDITS_QUERY_KEY,
    queryFn: getPipelineCredits,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const invalidatePipeline = () => {
    void qc.invalidateQueries({ queryKey: PIPELINE_SIGNALS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: PIPELINE_CREDITS_QUERY_KEY });
  };

  const dismissMutation = useMutation({
    mutationFn: (signalId: string) => patchPipelineSignalStatus(signalId, "dismissed"),
    onSuccess: (updated) => {
      setActionError(null);
      if (selectedSignal?.signalId === updated.signalId) setSelectedSignal(updated);
      invalidatePipeline();
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Dismiss failed"),
  });

  const reviewMutation = useMutation({
    mutationFn: (signalId: string) => patchPipelineSignalStatus(signalId, "reviewed"),
    onSuccess: (updated) => {
      setActionError(null);
      if (selectedSignal?.signalId === updated.signalId) setSelectedSignal(updated);
      invalidatePipeline();
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Review failed"),
  });

  const stageMutation = useMutation({
    mutationFn: ({ signalId, stage }: { signalId: string; stage: RapidIqProcurementStage }) =>
      patchPipelineSignal(signalId, { procurementStage: stage }),
    onSuccess: (updated) => {
      setActionError(null);
      if (selectedSignal?.signalId === updated.signalId) setSelectedSignal(updated);
      invalidatePipeline();
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Stage update failed"),
  });

  const pushMutation = useMutation({
    mutationFn: async (signal: RapidIqPipelineSignal) => {
      const result = await pushPipelineSignalToCrm(signal.signalId, {
        overrideAgencyName: signal.agencyName,
        notes: signal.summary,
      });
      return { result, signal };
    },
    onSuccess: ({ result, signal }) => {
      setActionError(null);
      const agency = signal.agencyName ?? signal.jurisdiction ?? "agency";
      setToast(`Pushed to CRM — ${agency}`);
      const updated: RapidIqPipelineSignal = {
        ...signal,
        status: "pushed",
        crmLeadId: result.leadId,
      };
      if (selectedSignal?.signalId === signal.signalId) setSelectedSignal(updated);
      invalidatePipeline();
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Push to CRM failed"),
  });

  const allSignals = itemsProp ?? data ?? [];
  const signals = allSignals.filter((s) => {
    if (activeTab === "all") {
      if (s.status === "dismissed") return false;
    } else if (activeTab === "ready") {
      if (s.status !== "new" && s.status !== "reviewed") return false;
    } else if (s.status !== activeTab) {
      return false;
    }
    return matchesProcurementStageFilter(resolveProcurementStage(s), stageFilter);
  });
  const readyCount = allSignals.filter((s) => s.status === "new" || s.status === "reviewed").length;
  const credits = creditsQuery.data;
  const busy =
    dismissMutation.isPending ||
    reviewMutation.isPending ||
    pushMutation.isPending ||
    stageMutation.isPending;

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-white"
          : "min-h-[70vh] bg-slate-950 text-white rounded-lg border border-slate-800 overflow-hidden"
      }
    >
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                Pipeline{categoryLabel ? ` · ${categoryLabel}` : ""}
              </h2>
              {readyCount > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {readyCount}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Push to CRM to create a Lead and start outreach
            </p>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <CreditMeter label="Apollo" status={credits?.apollo} />
            <CreditMeter label="Hunter" status={credits?.hunter} />
            <button
              type="button"
              onClick={() => invalidatePipeline()}
              className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex gap-1 mt-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                activeTab === tab.value
                  ? "bg-slate-700 text-white font-medium"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ProcurementStageTabs value={stageFilter} onChange={setStageFilter} />
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`rounded px-2 py-1 text-[10px] font-semibold ${
                viewMode === "kanban" ? "bg-slate-700 text-white" : "text-slate-500"
              }`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded px-2 py-1 text-[10px] font-semibold ${
                viewMode === "list" ? "bg-slate-700 text-white" : "text-slate-500"
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-xs text-emerald-300">
          {toast}
        </div>
      )}
      {actionError && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-300">
          {actionError}
        </div>
      )}

      <div className={embedded ? "min-h-0 flex-1 overflow-y-auto p-4" : "h-[calc(100vh-220px)] min-h-[420px] overflow-y-auto p-4"}>
        {itemsProp == null && isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
            Loading signals…
          </div>
        ) : itemsProp == null && error ? (
          <div className="flex items-center justify-center h-48 text-red-400 text-sm">
            Failed to load signals.
          </div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <div className="text-slate-500 text-sm">No pipeline items in this category</div>
            <div className="text-slate-600 text-xs">
              From the inbox, send keepers here — then Push to CRM
            </div>
          </div>
        ) : viewMode === "kanban" ? (
          <div className="space-y-3">
            <PipelineKanban
              signals={signals}
              busy={busy || stageMutation.isPending}
              onMoveStage={(signalId, stage) => stageMutation.mutate({ signalId, stage })}
              onOpen={(signal) =>
                setSelectedSignal((cur) => (cur?.signalId === signal.signalId ? null : signal))
              }
            />
            {selectedSignal && (
              <SignalDetailPanel
                signal={selectedSignal}
                credits={credits}
                anchored
                onClose={() => setSelectedSignal(null)}
                onSignalUpdated={(updated) => {
                  setSelectedSignal(updated);
                  invalidatePipeline();
                }}
              />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map((signal) => {
              const isOpen = selectedSignal?.signalId === signal.signalId;
              return (
                <div
                  key={signal.signalId}
                  className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-start"
                >
                  <div className="min-w-0 w-full max-w-3xl shrink-0 lg:w-[min(100%,48rem)]">
                    <SignalCard
                      signal={selectedSignal?.signalId === signal.signalId ? selectedSignal : signal}
                      selected={isOpen}
                      busy={busy}
                      onOpen={() =>
                        setSelectedSignal((cur) =>
                          cur?.signalId === signal.signalId ? null : signal,
                        )
                      }
                      onPushToCrm={() => pushMutation.mutate(signal)}
                      onReview={() => reviewMutation.mutate(signal.signalId)}
                      onDismiss={() => dismissMutation.mutate(signal.signalId)}
                    />
                  </div>
                  {isOpen && selectedSignal && (
                    <div className="min-w-0 w-full max-w-xl lg:sticky lg:top-0 lg:max-w-[440px]">
                      <SignalDetailPanel
                        signal={selectedSignal}
                        credits={credits}
                        anchored
                        onClose={() => setSelectedSignal(null)}
                        onSignalUpdated={(updated) => {
                          setSelectedSignal(updated);
                          invalidatePipeline();
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Alias used by the Rapid IQ page toggle. */
export const PipelineView = PipelineSignalsClient;
