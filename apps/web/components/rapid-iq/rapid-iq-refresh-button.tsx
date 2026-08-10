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
};

export function RapidIqRefreshButton({ demo = false, refreshStatus: externalStatus }: Props) {
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

  const mutation = useMutation({
    mutationFn: () => triggerRefresh(demo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: REFRESH_STATUS_QUERY_KEY });
      // Optimistically show running until status poll confirms
      qc.setQueryData<RefreshStatus>(REFRESH_STATUS_QUERY_KEY, (prev) => ({
        status: "running",
        startedAt: new Date().toISOString(),
        completedAt: null,
        signalsFound: prev?.signalsFound ?? 0,
        error: null,
      }));
    },
  });

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
      {mutation.isError && (
        <span className="text-[10px] text-red-400">
          {mutation.error instanceof Error ? mutation.error.message : "Refresh failed"}
        </span>
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
