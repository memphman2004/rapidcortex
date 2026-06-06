"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { canAccessRcRevenuePortal } from "rapid-cortex-shared/tenancy/principal";
import { fetchAgencies } from "@/lib/api";
import { VERTICAL_CONFIG, deriveVerticalFromAgencyId, normalizeVertical, type Vertical } from "@/components/ui/VerticalBadge";
import { isVerticalEnabled } from "@/lib/features";

interface UsageRow {
  customerId: string;
  agencyId: string;
  keyId: string;
  keyName?: string;
  yearMonth: string;
  totalCalls: number;
  tier: string;
  monthlyCallLimit?: number;
  overageCalls?: number;
  lastCallAt?: string;
}

const TIER_QUOTAS: Record<string, number> = {
  dev: 1_000,
  small: 25_000,
  medium: 100_000,
  large: 500_000,
  enterprise: Infinity,
};

const TIER_FEES: Record<string, number> = {
  dev: 500,
  small: 2_500,
  medium: 8_500,
  large: 18_000,
  enterprise: 0,
};

const OVERAGE_RATES: Record<string, number> = {
  dev: 0.5,
  small: 0.1,
  medium: 0.08,
  large: 0.05,
  enterprise: 0,
};

function calcOverage(calls: number, tier: string): number {
  const quota = TIER_QUOTAS[tier] ?? 1_000;
  const overage = Math.max(0, calls - quota);
  const rate = OVERAGE_RATES[tier] ?? 0.5;
  return Math.round((overage / 1_000) * rate * 100) / 100;
}

function tierBadge(tier: string) {
  const styles: Record<string, string> = {
    dev: "border-slate-700 bg-slate-800 text-slate-400",
    small: "border-sky-700/50 bg-sky-900/30 text-sky-300",
    medium: "border-emerald-700/50 bg-emerald-900/30 text-emerald-300",
    large: "border-violet-700/50 bg-violet-900/30 text-violet-300",
    enterprise: "border-amber-700/50 bg-amber-900/30 text-amber-300",
  };
  return styles[tier] ?? styles.dev;
}

function usagePct(calls: number, tier: string): number {
  const quota = TIER_QUOTAS[tier] ?? 1_000;
  if (quota === Infinity) return 0;
  return Math.min(100, Math.round((calls / quota) * 100));
}

function pctColor(pct: number): string {
  if (pct >= 100) return "text-red-400 font-bold";
  if (pct >= 90) return "text-red-400";
  if (pct >= 75) return "text-amber-400";
  return "text-slate-400";
}

export function RcAdminUsageTab({ userRole }: { userRole: string }) {
  const isSuperAdmin = canAccessRcRevenuePortal(userRole);
  const now = new Date();
  const [yearMonth, setYearMonth] = useState(now.toISOString().slice(0, 7));
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/rc-admin/usage?yearMonth=${yearMonth}`)
      .then(async (r) => {
        const d = (await r.json()) as { customers?: UsageRow[]; error?: string };
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        setRows(d.customers ?? []);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load usage");
      })
      .finally(() => setLoading(false));
  }, [yearMonth]);

  const agenciesQ = useQuery({ queryKey: ["agencies"], queryFn: fetchAgencies });
  const agencyVerticalMap = useMemo(() => {
    const map = new Map<string, Vertical>();
    for (const agency of agenciesQ.data ?? []) {
      const maybe = (agency as { vertical?: string }).vertical;
      map.set(
        agency.agencyId,
        maybe ? normalizeVertical(maybe) : deriveVerticalFromAgencyId(agency.agencyId),
      );
    }
    return map;
  }, [agenciesQ.data]);

  const totalCalls = rows.reduce((s, r) => s + (r.totalCalls ?? 0), 0);
  const totalBaseMrr = rows.reduce((s, r) => s + (TIER_FEES[r.tier] ?? 500), 0);
  const totalOverage = rows.reduce((s, r) => s + calcOverage(r.totalCalls ?? 0, r.tier), 0);
  const totalRevenue = totalBaseMrr + totalOverage;
  const atRisk = rows.filter((r) => usagePct(r.totalCalls, r.tier) >= 90).length;
  const usageByVertical = useMemo(() => {
    const agg: Record<Vertical, { calls: number; customers: number }> = {
      core: { calls: 0, customers: 0 },
      campus: { calls: 0, customers: 0 },
      venue: { calls: 0, customers: 0 },
      hospital: { calls: 0, customers: 0 },
    };
    const customerKeys = {
      core: new Set<string>(),
      campus: new Set<string>(),
      venue: new Set<string>(),
      hospital: new Set<string>(),
    } as const;
    for (const row of rows) {
      const vertical = agencyVerticalMap.get(row.agencyId) ?? deriveVerticalFromAgencyId(row.agencyId);
      agg[vertical].calls += row.totalCalls ?? 0;
      customerKeys[vertical].add(row.customerId);
    }
    for (const vertical of Object.keys(agg) as Vertical[]) {
      agg[vertical].customers = customerKeys[vertical].size;
    }
    return agg;
  }, [rows, agencyVerticalMap]);
  const peakVerticalCalls = Math.max(
    1,
    ...Object.values(usageByVertical).map((v) => v.calls),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200"
          />
          {atRisk > 0 ? (
            <span className="rounded border border-amber-500/50 bg-amber-950/30 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
              {atRisk} customer{atRisk > 1 ? "s" : ""} near quota limit
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.open(`/api/rc-admin/usage/export?yearMonth=${yearMonth}`, "_blank")}
            className="rounded border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-700/60"
          >
            Export CSV
          </button>
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={() =>
                window.open(
                  `/api/rc-admin/usage/export?yearMonth=${yearMonth}&format=billing`,
                  "_blank",
                )
              }
              className="rounded border border-emerald-700/50 bg-emerald-900/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/50"
            >
              Export for Bill.com
            </button>
          ) : null}
        </div>
      </div>

      <div className={`grid gap-4 ${isSuperAdmin ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <SummaryCard label="Active API Customers" value={rows.length.toString()} />
        <SummaryCard label={`Total Calls — ${yearMonth}`} value={totalCalls.toLocaleString()} />
        <SummaryCard
          label="Near/At Quota"
          value={atRisk.toString()}
          accent={atRisk > 0 ? "amber" : undefined}
        />
        {isSuperAdmin ? (
          <SummaryCard
            label={`Est. Revenue — ${yearMonth}`}
            value={`$${totalRevenue.toLocaleString()}`}
            sub={`$${totalBaseMrr.toLocaleString()} base + $${totalOverage.toLocaleString()} overage`}
            accent="emerald"
          />
        ) : null}
      </div>

      <section className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Usage by vertical
        </h2>
        <div className="mt-3 space-y-2">
          {(Object.keys(usageByVertical) as Vertical[])
            .filter((vertical) => isVerticalEnabled(vertical))
            .map((vertical) => {
            const cfg = VERTICAL_CONFIG[vertical];
            const row = usageByVertical[vertical];
            const widthPct = Math.round((row.calls / peakVerticalCalls) * 100);
            return (
              <div key={vertical} className="rounded border border-slate-800 bg-slate-950/40 p-2">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: cfg.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    {cfg.label}
                  </span>
                  <span className="font-mono text-slate-300">
                    {row.calls.toLocaleString()} calls · {row.customers} customer{row.customers === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${widthPct}%`, backgroundColor: cfg.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Customer API Usage — {yearMonth}
          </span>
          <span className="text-[10px] text-slate-600">{rows.length} customers</span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading usage data…</p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-red-400">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No API usage recorded for {yearMonth}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <th className="px-4 py-2.5 text-left">Customer</th>
                  <th className="px-4 py-2.5 text-left">Tier</th>
                  <th className="px-4 py-2.5 text-right">Calls</th>
                  <th className="px-4 py-2.5 text-right">Quota</th>
                  <th className="px-4 py-2.5 text-right">Usage</th>
                  {isSuperAdmin ? <th className="px-4 py-2.5 text-right">Base Fee</th> : null}
                  {isSuperAdmin ? <th className="px-4 py-2.5 text-right">Overage</th> : null}
                  {isSuperAdmin ? <th className="px-4 py-2.5 text-right">Total Due</th> : null}
                  <th className="px-4 py-2.5 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((row) => {
                  const quota = TIER_QUOTAS[row.tier] ?? 1_000;
                  const pct = usagePct(row.totalCalls, row.tier);
                  const overage = calcOverage(row.totalCalls, row.tier);
                  const baseFee = TIER_FEES[row.tier] ?? 500;
                  const isExpanded = expanded === row.keyId;
                  const colSpan = isSuperAdmin ? 9 : 6;

                  return (
                    <Fragment key={row.keyId}>
                      <tr className="hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-200">{row.customerId}</p>
                          <p className="text-[11px] text-slate-500">{row.agencyId}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${tierBadge(row.tier)}`}
                          >
                            {row.tier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-200">
                          {(row.totalCalls ?? 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {quota === Infinity ? "∞" : quota.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-500" : "bg-sky-500"}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className={`w-8 text-right font-mono text-xs ${pctColor(pct)}`}>
                              {quota === Infinity ? "—" : `${pct}%`}
                            </span>
                          </div>
                        </td>
                        {isSuperAdmin ? (
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            ${baseFee.toLocaleString()}
                          </td>
                        ) : null}
                        {isSuperAdmin ? (
                          <td className="px-4 py-3 text-right font-mono">
                            <span className={overage > 0 ? "text-amber-400" : "text-slate-600"}>
                              {overage > 0 ? `$${overage}` : "—"}
                            </span>
                          </td>
                        ) : null}
                        {isSuperAdmin ? (
                          <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-300">
                            ${(baseFee + overage).toLocaleString()}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpanded(isExpanded ? null : row.keyId)}
                            className="text-[11px] text-sky-400 hover:text-sky-300"
                          >
                            {isExpanded ? "Close" : "Detail →"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={colSpan} className="bg-slate-950/60 px-4 py-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                  API Key
                                </p>
                                <p className="font-mono text-xs text-slate-400">{row.keyId}</p>
                                {row.keyName ? (
                                  <p className="text-xs text-slate-500">{row.keyName}</p>
                                ) : null}
                                {row.lastCallAt ? (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Last activity: {new Date(row.lastCallAt).toLocaleString()}
                                  </p>
                                ) : null}
                              </div>
                              {isSuperAdmin ? (
                                <div>
                                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    Billing
                                  </p>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Base fee ({row.tier})</span>
                                      <span className="font-mono text-slate-300">
                                        ${(TIER_FEES[row.tier] ?? 500).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Overage calls</span>
                                      <span className="font-mono text-slate-300">
                                        {Math.max(
                                          0,
                                          (row.totalCalls ?? 0) - (TIER_QUOTAS[row.tier] ?? 1_000),
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Overage fee</span>
                                      <span
                                        className={`font-mono ${overage > 0 ? "text-amber-400" : "text-slate-600"}`}
                                      >
                                        ${overage}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-800 pt-1 font-semibold">
                                      <span className="text-slate-400">Total due</span>
                                      <span className="font-mono text-emerald-300">
                                        ${((TIER_FEES[row.tier] ?? 500) + overage).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
              {isSuperAdmin ? (
                <tfoot>
                  <tr className="border-t-2 border-slate-700 bg-slate-900/80 font-semibold">
                    <td className="px-4 py-3 text-slate-300" colSpan={2}>
                      Totals ({rows.length} customers)
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">
                      {totalCalls.toLocaleString()}
                    </td>
                    <td colSpan={2} />
                    <td className="px-4 py-3 text-right font-mono text-slate-200">
                      ${totalBaseMrr.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400">
                      ${totalOverage.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-300">
                      ${totalRevenue.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Monthly billing workflow
        </p>
        <ol className="list-inside list-decimal space-y-1 text-xs text-slate-400">
          <li>On the 1st of each month — export CSV for prior month</li>
          <li>Review overage calls — add to invoice total</li>
          <li>Create invoice in QuickBooks / Bill.com using the totals</li>
          <li>Send to agency procurement contact — net 30 terms</li>
          <li>Upload signed PO to Billing POs section when received</li>
        </ol>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "amber";
}) {
  const borderColor =
    accent === "emerald"
      ? "border-emerald-700/40 bg-emerald-950/20"
      : accent === "amber"
        ? "border-amber-700/40 bg-amber-950/20"
        : "border-slate-700/60 bg-slate-900/60";
  const valueColor =
    accent === "emerald" ? "text-emerald-300" : accent === "amber" ? "text-amber-300" : "text-white";

  return (
    <div className={`rounded-xl border p-4 ${borderColor}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-bold ${valueColor}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-slate-600">{sub}</p> : null}
    </div>
  );
}
