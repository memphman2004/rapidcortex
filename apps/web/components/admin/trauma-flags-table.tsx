"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TraumaFlagRecord } from "rapid-cortex-shared";
import { fetchWellnessTraumaFlags, isApiConfigured, postAckTraumaFlag } from "@/lib/api";

export function TraumaFlagsTable() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["wellness-trauma-flags"],
    queryFn: fetchWellnessTraumaFlags,
    enabled: isApiConfigured(),
    refetchInterval: 60_000,
  });

  const ack = useMutation({
    mutationFn: (flagId: string) => postAckTraumaFlag(flagId, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wellness-trauma-flags"] }),
  });

  if (!isApiConfigured()) {
    return <p className="text-sm text-slate-500">Configure the API to load trauma flags.</p>;
  }
  if (q.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (q.isError) {
    return <p className="text-sm text-rose-300">Could not load flags. Supervisor role required.</p>;
  }

  const rows = q.data ?? [];
  if (!rows.length) {
    return <p className="text-sm text-slate-500">No trauma-load flags recorded for your agency.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Incident</th>
            <th className="px-3 py-2">Dispatcher</th>
            <th className="px-3 py-2">Keywords</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: TraumaFlagRecord) => (
            <tr key={r.flagId} className="border-t border-slate-800/80">
              <td className="px-3 py-2 font-mono text-[10px] text-slate-400">
                {new Date(r.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-[10px]">{r.incidentId}</td>
              <td className="px-3 py-2 font-mono text-[10px]">{r.dispatcherUserId}</td>
              <td className="px-3 py-2">{r.matchedKeywords.join(", ")}</td>
              <td className="px-3 py-2">{r.status}</td>
              <td className="px-3 py-2">
                {r.status === "open" ? (
                  <button
                    type="button"
                    disabled={ack.isPending}
                    onClick={() => ack.mutate(r.flagId)}
                    className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
