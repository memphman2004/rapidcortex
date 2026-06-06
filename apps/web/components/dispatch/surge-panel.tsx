"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchSurgeClusterDetail,
  fetchSurgeClusters,
  isApiConfigured,
  postSurgeAnalyze,
  postSurgeClusterConfirm,
  postSurgeClusterDismiss,
} from "@/lib/api";
import { isSurgeEnabled } from "@/lib/runtime-flags";
import { SurgeAlert } from "@/components/surge/surge-alert";
import { SurgeClusterDetailSheet } from "@/components/surge/surge-cluster-detail-sheet";

function surgePriority(confidence: number, count: number): "critical" | "high" | "medium" | "low" {
  if (count >= 8 || confidence >= 0.9) return "critical";
  if (count >= 5 || confidence >= 0.75) return "high";
  if (count >= 3) return "medium";
  return "low";
}

export function SurgePanel({ incidentId }: { incidentId: string | null }) {
  const queryClient = useQueryClient();
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [detailClusterId, setDetailClusterId] = useState<string | null>(null);
  const [alertClusterId, setAlertClusterId] = useState<string | null>(null);
  const surgeOn = isSurgeEnabled();
  const configured = isApiConfigured();

  const q = useQuery({
    queryKey: ["surge-clusters", incidentId],
    enabled: Boolean(incidentId) && configured && surgeOn,
    queryFn: () => fetchSurgeClusters(incidentId!),
    staleTime: 15_000,
  });

  const detailQ = useQuery({
    queryKey: ["surge-cluster-detail", incidentId, detailClusterId],
    enabled: Boolean(incidentId && detailClusterId) && configured && surgeOn,
    queryFn: () => fetchSurgeClusterDetail(incidentId!, detailClusterId!),
  });

  const analyzeMut = useMutation({
    mutationFn: async () => {
      if (!incidentId) throw new Error("No incident");
      return postSurgeAnalyze(incidentId);
    },
    onSuccess: (res) => {
      setLocalErr(null);
      void queryClient.invalidateQueries({ queryKey: ["surge-clusters", incidentId] });
      if (res.clustersCreated > 0) {
        const top = (q.data ?? [])[0];
        if (top) setAlertClusterId(top.clusterId);
      }
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: async (clusterId: string) => {
      if (!incidentId) throw new Error("No incident");
      return postSurgeClusterConfirm(incidentId, clusterId);
    },
    onSuccess: () => {
      setDetailClusterId(null);
      void queryClient.invalidateQueries({ queryKey: ["surge-clusters", incidentId] });
    },
  });

  const dismissMut = useMutation({
    mutationFn: async (clusterId: string) => {
      if (!incidentId) throw new Error("No incident");
      return postSurgeClusterDismiss(incidentId, clusterId);
    },
    onSuccess: () => {
      setDetailClusterId(null);
      setAlertClusterId(null);
      void queryClient.invalidateQueries({ queryKey: ["surge-clusters", incidentId] });
    },
  });

  const alertCluster = (q.data ?? []).find((c) => c.clusterId === alertClusterId);

  if (!surgeOn) return null;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-[10px] font-semibold tracking-wide text-amber-400">Rapid Cortex Surge</div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        Detect duplicate callers during spikes — group by time, location, and shared keywords; surface unique details
        per caller.
      </p>
      {alertCluster && incidentId ? (
        <div className="mt-3">
          <SurgeAlert
            clusterId={alertCluster.clusterId}
            callCount={alertCluster.incidentCount}
            incidentType={alertCluster.headlineKeywords[0] ?? "related calls"}
            location={alertCluster.headlineKeywords.slice(0, 3).join(", ") || "See cluster"}
            priority={surgePriority(alertCluster.confidence, alertCluster.incidentCount)}
            onView={() => {
              setDetailClusterId(alertCluster.clusterId);
              setAlertClusterId(null);
            }}
            onDismiss={() => setAlertClusterId(null)}
          />
        </div>
      ) : null}
      {!incidentId ? (
        <p className="mt-2 text-xs text-slate-500">Select an incident.</p>
      ) : !configured ? (
        <p className="mt-2 text-xs text-slate-500">API not configured.</p>
      ) : (
        <>
          {localErr ? (
            <p className="mt-2 text-xs text-rose-300" role="alert">
              {localErr}
            </p>
          ) : null}
          <button
            type="button"
            disabled={analyzeMut.isPending}
            onClick={() => analyzeMut.mutate()}
            className="mt-2 w-full rounded bg-amber-800/80 px-2 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-700/80 disabled:opacity-50"
          >
            {analyzeMut.isPending ? "Analyzing…" : "Run Surge analysis"}
          </button>
          <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto text-[11px]">
            {(q.data ?? []).map((c) => (
              <li key={c.clusterId}>
                <button
                  type="button"
                  onClick={() => setDetailClusterId(c.clusterId)}
                  className="w-full rounded border border-slate-800 bg-slate-900/50 p-2 text-left hover:border-amber-800/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{c.clusterId.slice(0, 12)}…</span>
                    <span className="text-[10px] uppercase text-slate-500">{c.status}</span>
                  </div>
                  <div className="mt-1 text-slate-300">
                    {c.incidentCount} calls · {(c.confidence * 100).toFixed(0)}% match
                  </div>
                  <div className="mt-1 line-clamp-2 text-slate-500">{c.headlineKeywords.join(", ")}</div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {detailQ.data ? (
        <SurgeClusterDetailSheet cluster={detailQ.data} onClose={() => setDetailClusterId(null)}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={confirmMut.isPending}
              onClick={() => detailClusterId && confirmMut.mutate(detailClusterId)}
              className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              Confirm same incident
            </button>
            <button
              type="button"
              disabled={dismissMut.isPending}
              onClick={() => detailClusterId && dismissMut.mutate(detailClusterId)}
              className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Dismiss cluster
            </button>
          </div>
        </SurgeClusterDetailSheet>
      ) : null}
    </section>
  );
}
