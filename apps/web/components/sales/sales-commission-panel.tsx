"use client";

import { useEffect, useMemo, useState } from "react";
import type { SalesLeadCrmRecord } from "rapid-cortex-shared";
import { computeCommission } from "@/lib/sales/commission-math";

type Props = { assigneeFilter?: string };

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function SalesCommissionPanel({ assigneeFilter }: Props) {
  const [leads, setLeads] = useState<SalesLeadCrmRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sales/earnings", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { leads?: SalesLeadCrmRecord[] };
        if (!cancelled) setLeads(data.leads ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const year = new Date().getFullYear();
  const won = useMemo(() => {
    return leads.filter((l) => {
      if (l.pipelineStage !== "WON") return false;
      if (assigneeFilter && (l.assignedTo ?? l.assignee) !== assigneeFilter) return false;
      const d = l.wonDate ?? l.stageUpdatedAt ?? l.updatedAt;
      if (d && new Date(d).getFullYear() !== year) return false;
      return true;
    });
  }, [leads, assigneeFilter, year]);

  const totals = useMemo(() => {
    let acv = 0;
    let commission = 0;
    for (const l of won) {
      const cents = Math.round((l.estimatedValue ?? 0) * 100);
      const r = computeCommission(cents);
      acv += r.acvCents;
      commission += r.commissionCents;
    }
    return {
      acv,
      commission,
      rate: acv > 0 ? commission / acv : 0,
    };
  }, [won]);

  const selected = won.find((l) => l.leadId === selectedId);
  const selectedBreakdown = selected
    ? computeCommission(Math.round((selected.estimatedValue ?? 0) * 100))
    : null;

  return (
    <div className="space-y-4 print:text-black">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-[#0a1628] px-4 py-3">
          <div className="text-[10px] font-bold uppercase text-slate-500">YTD ACV</div>
          <div className="mt-1 text-xl font-semibold text-white">
            {formatUsdFromCents(totals.acv)}
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#0a1628] px-4 py-3">
          <div className="text-[10px] font-bold uppercase text-slate-500">Commission earned</div>
          <div className="mt-1 text-xl font-semibold text-emerald-300">
            {formatUsdFromCents(totals.commission)}
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#0a1628] px-4 py-3">
          <div className="text-[10px] font-bold uppercase text-slate-500">Effective rate</div>
          <div className="mt-1 text-xl font-semibold text-sky-300">
            {(totals.rate * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-300"
        >
          Print statement
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-[#0a1628] text-[11px] uppercase text-slate-500">
              <th className="px-4 py-2">Agency</th>
              <th className="px-4 py-2">ACV</th>
              <th className="px-4 py-2">Commission</th>
            </tr>
          </thead>
          <tbody>
            {won.map((l) => {
              const c = computeCommission(Math.round((l.estimatedValue ?? 0) * 100));
              return (
                <tr
                  key={l.leadId}
                  className="cursor-pointer border-b border-white/[0.03] hover:bg-white/[0.02]"
                  onClick={() => setSelectedId(l.leadId)}
                >
                  <td className="px-4 py-2 text-slate-200">
                    {l.agencyName ?? l.agencyCompany ?? l.email}
                  </td>
                  <td className="px-4 py-2 text-slate-400">{formatUsdFromCents(c.acvCents)}</td>
                  <td className="px-4 py-2 text-emerald-300/90">
                    {formatUsdFromCents(c.commissionCents)}
                  </td>
                </tr>
              );
            })}
            {won.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  No WON deals in {year} yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedBreakdown && (
        <div className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
          <h3 className="text-sm font-semibold text-white">Tier breakdown</h3>
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            {selectedBreakdown.rows.map((r) => (
              <li key={r.label}>
                {r.label}: {formatUsdFromCents(r.bandCents)} @ {(r.rate * 100).toFixed(0)}% ={" "}
                {formatUsdFromCents(r.commissionCents)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
