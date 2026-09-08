"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  getCallAssistBotFleet,
  getCallAssistBotQuota,
  postCallAssistBotRebuild,
  postCallAssistRebuildAllOutdated,
} from "@/lib/call-assist/call-assist-api";

function statusLabel(status: string, current: boolean): { text: string; className: string } {
  if (status === "BUILT" && current) return { text: "BUILT", className: "text-emerald-300" };
  if (status === "UPDATE_PENDING" || status === "UPDATING" || status === "BUILDING") {
    return { text: status.replaceAll("_", " "), className: "text-amber-300" };
  }
  if (status === "FAILED") return { text: "FAILED", className: "text-rose-400" };
  if (!current && status !== "NOT_CREATED") return { text: "OUTDATED", className: "text-amber-200" };
  return { text: status.replaceAll("_", " "), className: "text-slate-300" };
}

export function CallAssistBotFleetClient() {
  const qc = useQueryClient();
  const fleetQuery = useQuery({
    queryKey: ["call-assist-bot-fleet"],
    queryFn: getCallAssistBotFleet,
    refetchInterval: 30_000,
  });

  const rebuildOne = useMutation({
    mutationFn: postCallAssistBotRebuild,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["call-assist-bot-fleet"] }),
  });
  const rebuildAll = useMutation({
    mutationFn: postCallAssistRebuildAllOutdated,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["call-assist-bot-fleet"] }),
  });
  const quotaQuery = useMutation({
    mutationFn: getCallAssistBotQuota,
  });

  const data = fleetQuery.data;
  const quota = data?.quota;
  const busy = rebuildOne.isPending || rebuildAll.isPending;

  if (fleetQuery.isLoading) {
    return <p className="text-sm text-slate-400">Loading Call Assist bot fleet…</p>;
  }
  if (fleetQuery.error) {
    return (
      <p className="text-sm text-rose-400">
        {fleetQuery.error instanceof Error ? fleetQuery.error.message : "Failed to load bot fleet"}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-xl font-semibold text-white">Call Assist — bot fleet management</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          The Lex template is universal. Agency names and officer labels come from voice config at
          Lambda time. Template bumps rebuild one bot at a time (~5 minutes each); live aliases keep
          serving until switched — no downtime, but a Friday bump may still be rolling Saturday
          morning.
        </p>
        <p className="mt-3 font-mono text-sm text-violet-200">
          Template version: {data?.templateVersion ?? "—"}
          <span className="mx-2 text-slate-600">·</span>
          AWS Lex quota: {quota?.currentBotCount ?? "—"} / {quota?.limit ?? "—"} bots
          {typeof data?.estimatedRebuildMinutes === "number" && data.pendingRebuilds > 0 ? (
            <>
              <span className="mx-2 text-slate-600">·</span>
              Rolling rebuild ETA: up to {data.estimatedRebuildMinutes} min ({data.pendingRebuilds}{" "}
              bot{data.pendingRebuilds === 1 ? "" : "s"})
            </>
          ) : null}
        </p>
      </div>

      {data?.quotaBlocking ? (
        <div className="flex gap-3 rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Lex bot quota headroom is below 5. The provisioner will refuse new bots until you request
            a Service Quota increase to 1,000+ (quota {quota?.quotaCode}). AWS usually takes 1–3
            business days.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !data?.outdatedCount}
          onClick={() => void rebuildAll.mutateAsync()}
          className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Rebuild all outdated
        </button>
        <button
          type="button"
          onClick={() => void quotaQuery.mutateAsync()}
          className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
        >
          View quota
        </button>
        <a
          href={data?.quotaConsoleUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-slate-700 px-4 py-2 text-sm text-sky-300 hover:border-sky-500"
        >
          Service Quota request
        </a>
      </div>

      {quotaQuery.data ? (
        <p className="text-sm text-slate-300">
          Live quota check: {quotaQuery.data.quota.currentBotCount} / {quotaQuery.data.quota.limit}{" "}
          (headroom {quotaQuery.data.quota.headroom}
          {quotaQuery.data.quotaBlocking ? ", blocked" : ""}).
        </p>
      ) : null}
      {rebuildAll.data ? (
        <p className="text-sm text-emerald-300">Queued {rebuildAll.data.enqueued} rebuild(s).</p>
      ) : null}

      <div className="overflow-auto rounded-lg border border-slate-800 bg-neutral-950">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="px-4 py-2">Agency</th>
              <th className="px-4 py-2">Bot name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Template</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.bots ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  No Call Assist tenants yet. Fill voice config, then POST /api/call-assist/onboarding.
                </td>
              </tr>
            ) : (
              (data?.bots ?? []).map((bot) => {
                const status = statusLabel(bot.status, bot.current);
                const building = ["BUILDING", "UPDATING", "CREATING"].includes(bot.status);
                return (
                  <tr key={bot.agencyId} className="border-t border-neutral-900">
                    <td className="px-4 py-2">
                      <div className="text-slate-100">{bot.agencyDisplayName}</div>
                      <div className="font-mono text-xs text-slate-500">{bot.agencyId}</div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-300">{bot.botName ?? "—"}</td>
                    <td className={`px-4 py-2 font-medium ${status.className}`}>{status.text}</td>
                    <td className="px-4 py-2 text-slate-300">
                      {bot.current ? "current" : bot.templateVersion ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      {building || bot.status === "NOT_CREATED" ? (
                        <span className="text-xs text-slate-500">
                          {building ? "building" : "not created"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void rebuildOne.mutateAsync(bot.agencyId)}
                          className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-violet-400"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Rebuild
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
