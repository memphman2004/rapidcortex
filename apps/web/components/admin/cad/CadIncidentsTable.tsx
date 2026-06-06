"use client";

import { Fragment } from "react";
import type { CadRawIncidentRow } from "@/lib/api";
import { CadRawWebhookLog } from "./CadRawWebhookLog";
import {
  extractCadPreview,
  normalizePriorityBadge,
  priorityBadgeClass,
} from "./cad-admin-ui-helpers";

type Props = {
  rows: CadRawIncidentRow[];
  isLoading: boolean;
  expandedRawId: string | null;
  onToggleRow: (id: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

export function CadIncidentsTable({
  rows,
  isLoading,
  expandedRawId,
  onToggleRow,
  onRefresh,
  isRefreshing,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Last 50 receipts for this integration</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading incidents…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No webhook receipts in this window.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[640px] text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">CAD #</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Priority</th>
                <th className="px-2 py-2">Location</th>
                <th className="px-2 py-2">Received</th>
                <th className="px-2 py-2">RC incident</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = extractCadPreview(r.rawBody);
                const pb = normalizePriorityBadge(p.priority);
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="cursor-pointer border-b border-slate-800/80 hover:bg-slate-900/60"
                      onClick={() => onToggleRow(r.id)}
                    >
                      <td className="px-2 py-2 font-mono text-[11px] text-slate-200">{p.cadNumber}</td>
                      <td className="max-w-[140px] truncate px-2 py-2 text-slate-300">{p.callType}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadgeClass(pb)}`}
                        >
                          {pb === "—" ? p.priority : pb}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-2 py-2 text-slate-400">{p.location}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-500">{r.receivedAt}</td>
                      <td className="px-2 py-2 font-mono text-[10px] text-sky-300/90">
                        {r.linkedIncidentId ?? "—"}
                      </td>
                    </tr>
                    {expandedRawId === r.id ? (
                      <tr className="bg-slate-950/80">
                        <td colSpan={6} className="px-3 py-3">
                          <p className="mb-2 text-[10px] font-medium uppercase text-slate-500">Raw payload</p>
                          <CadRawWebhookLog rawBody={r.rawBody} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
