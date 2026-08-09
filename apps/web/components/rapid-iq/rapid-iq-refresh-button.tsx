"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { fetchRefreshStatus, REFRESH_STATUS_QUERY_KEY, triggerRefresh } from "@/lib/rapid-iq/api";
import type { RefreshStatus } from "@/lib/rapid-iq/types";
import { formatTimeAgo } from "@/lib/rapid-iq/scoring";

type Props = {
  demo?: boolean;
  refreshStatus?: RefreshStatus;
};

export function RapidIqRefreshButton({ demo = false, refreshStatus: externalStatus }: Props) {
  const qc = useQueryClient();

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

  const mutation = useMutation({
    mutationFn: () => triggerRefresh(demo),
    onSuccess: () => void qc.invalidateQueries({ queryKey: REFRESH_STATUS_QUERY_KEY }),
  });

  return (
    <div className="flex items-center gap-2">
      {refreshStatus?.completedAt && !isRunning && (
        <span className="hidden text-[10px] text-slate-600 sm:inline">
          Last updated {formatTimeAgo(refreshStatus.completedAt)}
        </span>
      )}
      {isRunning && (
        <span className="text-[10px] text-sky-400 animate-pulse">Scanning sources…</span>
      )}
      {refreshStatus?.status === "error" && (
        <span className="text-[10px] text-red-400">Scan failed</span>
      )}
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={isRunning || mutation.isPending || demo}
        title={demo ? "Refresh requires live API" : undefined}
        className="flex items-center gap-1.5 rounded border border-[rgba(255,255,255,0.08)] bg-[#0d1b35] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-[#102040] disabled:opacity-50"
      >
        <RefreshCw size={11} className={isRunning ? "animate-spin" : ""} />
        {isRunning ? "Updating…" : "Update Now"}
      </button>
    </div>
  );
}
