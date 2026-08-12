"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type {
  RapidIqPipelineCreditToolStatus,
  RapidIqPipelineSignal,
  RapidIqPipelineSignalStatus,
} from "rapid-cortex-shared";
import { RAPID_IQ_PIPELINE_SOURCE_LABELS } from "rapid-cortex-shared";
import {
  getPipelineCredits,
  getPipelineSignals,
  patchPipelineSignalStatus,
  PIPELINE_CREDITS_QUERY_KEY,
} from "@/lib/rapid-iq/pipeline-api";
import { SignalDetailPanel } from "./signal-detail-panel";

const QUERY_KEY = ["rapid-iq-pipeline-signals"] as const;

const STATUS_TABS: Array<{ value: RapidIqPipelineSignalStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
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
  onClick,
  onDismiss,
}: {
  signal: RapidIqPipelineSignal;
  onClick: () => void;
  onDismiss: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-600 hover:bg-slate-800/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sourceBadge(signal.sourceId)}`}
            >
              {RAPID_IQ_PIPELINE_SOURCE_LABELS[signal.sourceId] ?? signal.sourceId}
            </span>
            {signal.status === "pushed" && (
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
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <div className="text-right">
            <div className="text-2xl font-bold text-white leading-none">{signal.fitScore}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">fit</div>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${fitBadge(signal.fitLabel)}`}
          >
            {signal.fitLabel}
          </span>
        </div>
      </div>

      {(signal.status === "new" || signal.status === "reviewed") && (
        <div className="mt-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-600"
          >
            Dismiss
          </button>
        </div>
      )}
    </button>
  );
}

export function PipelineSignalsClient() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<RapidIqPipelineSignalStatus | "all">("new");
  const [selectedSignal, setSelectedSignal] = useState<RapidIqPipelineSignal | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: [...QUERY_KEY, activeTab],
    queryFn: () => getPipelineSignals(activeTab === "all" ? undefined : activeTab),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const creditsQuery = useQuery({
    queryKey: PIPELINE_CREDITS_QUERY_KEY,
    queryFn: getPipelineCredits,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const dismissMutation = useMutation({
    mutationFn: (signalId: string) => patchPipelineSignalStatus(signalId, "dismissed"),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const signals = data ?? [];
  const newCount = signals.filter((s) => s.status === "new").length;
  const credits = creditsQuery.data;

  return (
    <div className="min-h-[70vh] bg-slate-950 text-white rounded-lg border border-slate-800 overflow-hidden">
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Signal Intelligence</h2>
              {newCount > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {newCount}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Procurement signal intelligence — public safety agencies
            </p>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <CreditMeter label="Apollo" status={credits?.apollo} />
            <CreditMeter label="Hunter" status={credits?.hunter} />
            <button
              type="button"
              onClick={() => {
                qc.invalidateQueries({ queryKey: QUERY_KEY });
                qc.invalidateQueries({ queryKey: PIPELINE_CREDITS_QUERY_KEY });
              }}
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
      </div>

      <div className="flex h-[calc(100vh-220px)] min-h-[420px]">
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              Loading signals…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48 text-red-400 text-sm">
              Failed to load signals.
            </div>
          ) : signals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <div className="text-slate-500 text-sm">No signals in this view</div>
              <div className="text-slate-600 text-xs">
                Ingestion runs on schedule — check back after the next run
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl">
              {signals.map((signal) => (
                <SignalCard
                  key={signal.signalId}
                  signal={signal}
                  onClick={() => setSelectedSignal(signal)}
                  onDismiss={(e) => {
                    e.stopPropagation();
                    dismissMutation.mutate(signal.signalId);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {selectedSignal && (
          <SignalDetailPanel
            signal={selectedSignal}
            credits={credits}
            onClose={() => setSelectedSignal(null)}
            onSignalUpdated={(updated) => {
              setSelectedSignal(updated);
              qc.invalidateQueries({ queryKey: QUERY_KEY });
              qc.invalidateQueries({ queryKey: PIPELINE_CREDITS_QUERY_KEY });
            }}
          />
        )}
      </div>
    </div>
  );
}
