"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SlaPriority, SlaStatus } from "rapid-cortex-shared";
import type { IncidentRow } from "@/lib/dashboards/mockDashboardData";
import { fetchSlaStatus, isSlaApiConfigured } from "@/lib/sla-api";
import { isSlaBacklogEnabled } from "@/lib/runtime-flags";
import { SlaIncidentBadge } from "@/components/dashboards/sla-incident-badge";
import { StatusBadge } from "@/components/dashboards/status-badge";
import { EmptyState } from "@/components/dashboards/empty-state";

function priorityRank(label: string): number {
  const u = label.toUpperCase();
  if (u.startsWith("P1") || u === "CRITICAL") return 0;
  if (u.startsWith("P2") || u === "HIGH") return 1;
  if (u.startsWith("P3") || u === "MODERATE") return 2;
  return 3;
}

function slaPriorityRank(p: SlaPriority): number {
  if (p === "P1") return 0;
  if (p === "P2") return 1;
  if (p === "P3") return 2;
  return 3;
}

function isBreached(sla: SlaStatus): boolean {
  return sla.answerSlaStatus === "breached" || sla.dispatchSlaStatus === "breached";
}

function sortRows(rows: IncidentRow[], slaById: Map<string, SlaStatus>): IncidentRow[] {
  return [...rows].sort((a, b) => {
    const slaA = slaById.get(a.id);
    const slaB = slaById.get(b.id);
    const prA = slaA ? slaPriorityRank(slaA.priority) : priorityRank(a.priority);
    const prB = slaB ? slaPriorityRank(slaB.priority) : priorityRank(b.priority);
    if (prA !== prB) return prA - prB;
    const breachA = slaA && isBreached(slaA) ? 0 : 1;
    const breachB = slaB && isBreached(slaB) ? 0 : 1;
    if (breachA !== breachB) return breachA - breachB;
    const elapsedA = slaA?.answerElapsedSeconds ?? 0;
    const elapsedB = slaB?.answerElapsedSeconds ?? 0;
    return elapsedB - elapsedA;
  });
}

export function IncidentTable({
  rows,
  emptyHint,
}: {
  rows: IncidentRow[];
  emptyHint?: string;
}) {
  const slaEnabled = isSlaBacklogEnabled() && isSlaApiConfigured();
  const slaQuery = useQuery({
    queryKey: ["sla-status"],
    queryFn: fetchSlaStatus,
    enabled: slaEnabled && rows.length > 0,
    refetchInterval: 30_000,
  });

  const slaById = useMemo(() => {
    const map = new Map<string, SlaStatus>();
    for (const s of slaQuery.data ?? []) map.set(s.incidentId, s);
    return map;
  }, [slaQuery.data]);

  const displayRows = useMemo(() => sortRows(rows, slaById), [rows, slaById]);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No incidents in this view"
        description={emptyHint ?? "Data will appear when incidents match your scope and filters."}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/40">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Incidents</h2>
        <p className="text-xs text-slate-500">Agency-scoped queue with SLA ordering when enabled.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">CAD</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              {slaEnabled ? <th className="px-4 py-2 font-medium">SLA</th> : null}
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Summary</th>
              <th className="px-4 py-2 font-medium">Agency</th>
              <th className="px-4 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {displayRows.map((row) => {
              const sla = slaById.get(row.id);
              return (
                <tr key={row.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-2 font-mono text-xs text-sky-200">{row.cadId}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">{row.priority}</span>
                  </td>
                  {slaEnabled ? (
                    <td className="px-4 py-2">{sla ? <SlaIncidentBadge sla={sla} /> : <span className="text-slate-600">—</span>}</td>
                  ) : null}
                  <td className="px-4 py-2">
                    <StatusBadge tone={row.status} />
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-slate-300">{row.summary}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{row.agencyId}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{row.updatedAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
