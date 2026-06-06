"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  buildAdminAnalyticsCsvUrl,
  fetchAdminAnalyticsSummary,
  isApiConfigured,
  postAdminAnalyticsRefresh,
} from "@/lib/api";

async function downloadCsv(agencyId?: string) {
  const url = buildAdminAnalyticsCsvUrl(agencyId);
  const USE_AUTH_PROXY = typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_PROXY === "1";
  const res = await fetch(url, { credentials: USE_AUTH_PROXY ? "include" : "same-origin" });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `analytics-${agencyId ?? "agency"}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function AdminAnalyticsPage() {
  const qc = useQueryClient();
  const [agencyId, setAgencyId] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["admin-analytics", agencyId || "default"],
    queryFn: () => fetchAdminAnalyticsSummary(agencyId.trim() || undefined),
    enabled: isApiConfigured(),
  });

  const refreshMut = useMutation({
    mutationFn: () => postAdminAnalyticsRefresh(agencyId.trim() || undefined, 14),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-analytics", agencyId || "default"] });
    },
  });

  const onDownload = useCallback(async () => {
    try {
      await downloadCsv(agencyId.trim() || undefined);
    } catch (e) {
      console.error(e);
    }
  }, [agencyId]);

  const s = summaryQuery.data as Record<string, unknown> | undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6 text-slate-100">
      <h1 className="text-lg font-semibold text-white">Agency analytics</h1>
      <p className="max-w-2xl text-sm text-slate-400">
        Summaries are cached in S3 under the analytics prefix. Refresh recomputes counts for your agency (or a
        platform-selected tenant when permitted).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs text-slate-400">
          Agency override (RC Admin only)
          <input
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            className="mt-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100"
            placeholder="leave blank for own agency"
          />
        </label>
        <button
          type="button"
          onClick={() => refreshMut.mutate()}
          disabled={refreshMut.isPending}
          className="rounded bg-amber-900/50 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-800/50 disabled:opacity-40"
        >
          {refreshMut.isPending ? "Refreshing…" : "Refresh cache"}
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="rounded border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
        >
          Download CSV
        </button>
      </div>
      {refreshMut.isError ? (
        <p className="text-xs text-rose-300">{(refreshMut.error as Error).message}</p>
      ) : null}
      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 font-mono text-xs text-slate-300">
        {summaryQuery.isLoading ? "Loading…" : null}
        <pre className="whitespace-pre-wrap">{JSON.stringify(s ?? {}, null, 2)}</pre>
      </section>
    </div>
  );
}
