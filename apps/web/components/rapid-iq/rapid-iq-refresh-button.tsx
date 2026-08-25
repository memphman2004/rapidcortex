"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  fetchRefreshStatus,
  OPPORTUNITIES_QUERY_KEY,
  REFRESH_STATUS_QUERY_KEY,
  triggerRefresh,
} from "@/lib/rapid-iq/api";
import type { RefreshStatus } from "@/lib/rapid-iq/types";
import { formatTimeAgo } from "@/lib/rapid-iq/scoring";

type Props = {
  demo?: boolean;
  refreshStatus?: RefreshStatus;
  pipelineEnabled?: boolean;
  pipelineCount?: number;
  showPipeline?: boolean;
  onTogglePipeline?: () => void;
  showAccounts?: boolean;
  onToggleAccounts?: () => void;
  onAddSignal?: () => void;
};

export function RapidIqRefreshButton({
  demo = false,
  refreshStatus: externalStatus,
  pipelineEnabled = false,
  pipelineCount = 0,
  showPipeline = false,
  onTogglePipeline,
  showAccounts = false,
  onToggleAccounts,
  onAddSignal,
}: Props) {
  const qc = useQueryClient();
  const prevStatusRef = useRef<RefreshStatus["status"] | undefined>(undefined);

  const statusQ = useQuery({
    queryKey: REFRESH_STATUS_QUERY_KEY,
    queryFn: () => fetchRefreshStatus(demo),
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 3000 : false,
    initialData: externalStatus,
    enabled: !externalStatus,
  });

  const refreshStatus = externalStatus ?? statusQ.data;
  const isRunning = refreshStatus?.status === "running";

  useEffect(() => {
    const next = refreshStatus?.status;
    const prev = prevStatusRef.current;
    prevStatusRef.current = next;
    if (prev === "running" && (next === "complete" || next === "error")) {
      void qc.invalidateQueries({ queryKey: OPPORTUNITIES_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ["rapid-iq-detail"] });
    }
  }, [refreshStatus?.status, qc]);

  const markRunning = () => {
    void qc.invalidateQueries({ queryKey: REFRESH_STATUS_QUERY_KEY });
    qc.setQueryData<RefreshStatus>(REFRESH_STATUS_QUERY_KEY, (prev) => ({
      status: "running",
      startedAt: new Date().toISOString(),
      completedAt: null,
      signalsFound: prev?.signalsFound ?? 0,
      error: null,
    }));
  };

  const refreshMutation = useMutation({
    mutationFn: () => triggerRefresh(demo, "manual"),
    onSuccess: markRunning,
  });

  const rampMutation = useMutation({
    mutationFn: () => triggerRefresh(demo, "ramp"),
    onSuccess: markRunning,
  });

  const busy = isRunning || refreshMutation.isPending || rampMutation.isPending;

  return (
    <div className="flex items-center gap-2">
      {refreshStatus?.completedAt && !isRunning && (
        <span className="hidden text-[10px] text-slate-600 sm:inline">
          Last updated {formatTimeAgo(refreshStatus.completedAt)}
          {typeof refreshStatus.signalsFound === "number"
            ? ` · ${refreshStatus.signalsFound} signal${refreshStatus.signalsFound === 1 ? "" : "s"}`
            : ""}
        </span>
      )}
      {isRunning && (
        <span className="text-[10px] text-sky-400 animate-pulse">Scanning sources…</span>
      )}
      {refreshStatus?.status === "error" && (
        <span className="text-[10px] text-red-400">
          Scan failed{refreshStatus.error ? `: ${refreshStatus.error}` : ""}
        </span>
      )}
      {(refreshMutation.isError || rampMutation.isError) && (
        <span className="text-[10px] text-red-400">
          {(refreshMutation.error ?? rampMutation.error) instanceof Error
            ? (refreshMutation.error ?? rampMutation.error)!.message
            : "Refresh failed"}
        </span>
      )}
      <button
        type="button"
        onClick={() => rampMutation.mutate()}
        disabled={busy || demo}
        title={demo ? "RAMP check requires live API" : "Scan RAMPLA.org for LA28 opportunities"}
        className="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
      >
        🏅 Check RAMP
      </button>
      {pipelineEnabled && onTogglePipeline && (
        <button
          type="button"
          className={`pipeline-toggle-btn ${showPipeline ? "active" : ""}`}
          onClick={() => onTogglePipeline()}
          aria-pressed={showPipeline}
        >
          <span>PIPELINE</span>
          {pipelineCount > 0 && (
            <span className="pipeline-count-badge">{pipelineCount}</span>
          )}
        </button>
      )}
      {pipelineEnabled && onToggleAccounts && (
        <button
          type="button"
          className={`pipeline-toggle-btn ${showAccounts ? "active" : ""}`}
          onClick={() => onToggleAccounts()}
          aria-pressed={showAccounts}
        >
          <span>ACCOUNTS</span>
        </button>
      )}
      {onAddSignal && (
        <button
          type="button"
          onClick={() => onAddSignal()}
          className="flex items-center gap-1.5 rounded border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-300 transition-colors hover:bg-sky-500/20"
        >
          + Add Signal
        </button>
      )}
      <button
        type="button"
        onClick={() => refreshMutation.mutate()}
        disabled={busy || demo}
        title={demo ? "Refresh requires live API" : undefined}
        className="flex items-center gap-1.5 rounded border border-[rgba(255,255,255,0.08)] bg-[#0d1b35] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-[#102040] disabled:opacity-50"
      >
        <RefreshCw size={11} className={isRunning ? "animate-spin" : ""} />
        {isRunning ? "Updating…" : "Update Now"}
      </button>
    </div>
  );
}
