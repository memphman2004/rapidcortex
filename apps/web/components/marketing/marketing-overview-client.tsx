"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  parseMarketingDashboardFilter,
  PRODUCT_MARKET_LABELS,
  serializeMarketingDashboardFilter,
  type MarketingDashboardFilter,
} from "rapid-cortex-shared";
import { MarketingFilterBar } from "./marketing-filter-bar";

// ─── API client ──────────────────────────────────────────────────────────────

async function fetchOverview(filter: MarketingDashboardFilter) {
  const qs = serializeMarketingDashboardFilter(filter).toString();
  const res = await fetch(`/api/rc-admin/marketing/overview${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load marketing overview");
  const body = await res.json() as { success: boolean; data: OverviewData };
  return body.data;
}

type OverviewData = {
  totals: { total: number; qualified: number; demos: number; won: number; attributedPipeline: number };
  byMarket: Record<string, number>;
  byZone: Record<string, number>;
  channelMix: Record<string, { count: number; label: string }>;
  topReferrers: { domain: string; count: number }[];
  filter: MarketingDashboardFilter;
};

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-[#0a1628] px-5 py-4">
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-3xl font-semibold tabular-nums text-white">{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

// ─── Shortcut tile ───────────────────────────────────────────────────────────

function ShortcutTile({ label, href, icon }: { label: string; href: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0a1628] px-4 py-4 text-center transition-colors hover:bg-white/[0.05]"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-slate-300">{label}</span>
    </Link>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function MarketingOverviewClient() {
  const sp = useSearchParams();
  const filter = parseMarketingDashboardFilter(Object.fromEntries(sp.entries()));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["marketing-overview", filter],
    queryFn: () => fetchOverview(filter),
  });

  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const fmtDollar = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n}`;

  return (
    <div className="space-y-6">
      <MarketingFilterBar filter={filter} />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Total Leads" value={isLoading ? "—" : fmt(data?.totals.total ?? 0)} />
        <KpiCard label="Qualified" value={isLoading ? "—" : fmt(data?.totals.qualified ?? 0)} />
        <KpiCard label="Demos" value={isLoading ? "—" : fmt(data?.totals.demos ?? 0)} />
        <KpiCard label="Won" value={isLoading ? "—" : fmt(data?.totals.won ?? 0)} />
        <KpiCard
          label="Attributed Pipeline"
          value={isLoading ? "—" : fmtDollar(data?.totals.attributedPipeline ?? 0)}
          sub="from open + won deals"
        />
      </div>

      {isError && (
        <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-400">
          Failed to load overview data.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Industry Performance */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Industry Performance</h2>
          <div className="space-y-3">
            {(["psap", "campus", "venue", "transit"] as const).map((market) => {
              const count = data?.byMarket[market] ?? 0;
              const total = data?.totals.total ?? 1;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={market} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-slate-400">
                    {PRODUCT_MARKET_LABELS[market]}
                  </span>
                  <div className="flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-2 rounded-full bg-sky-600 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-slate-400">
                    {isLoading ? "—" : count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales Zone Breakdown */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Sales Zone Activity</h2>
          <div className="space-y-3">
            {["zone-1", "zone-2", "zone-3", "zone-4", "zone-5", "zone-6"].map((z) => {
              const count = data?.byZone[z] ?? 0;
              const total = data?.totals.total ?? 1;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={z} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-slate-400">
                    {z.replace("zone-", "Zone ")}
                  </span>
                  <div className="flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-2 rounded-full bg-violet-600 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-slate-400">
                    {isLoading ? "—" : count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Channel Mix */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Lead Channel Mix</h2>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data?.channelMix ?? {})
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([key, ch]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{ch.label}</span>
                    <span className="tabular-nums text-slate-400">{ch.count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Top Referrers */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Top Referrers</h2>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (data?.topReferrers ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No referrer data yet.</p>
          ) : (
            <div className="space-y-2">
              {(data?.topReferrers ?? []).map((r) => (
                <div key={r.domain} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{r.domain}</span>
                  <span className="tabular-nums text-slate-400">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shortcut grid to existing tools */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Quick Access
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          <ShortcutTile label="Campaign Manager" href="/rc-admin/marketing/campaigns" icon="📣" />
          <ShortcutTile label="Lead Intelligence" href="/rc-admin/marketing/leads" icon="🎯" />
          <ShortcutTile label="Email & Newsletters" href="/rc-admin/marketing/email" icon="✉️" />
          <ShortcutTile label="Deployments Map" href="/rc-admin/deployments-map" icon="🗺️" />
          <ShortcutTile label="Prospects" href="/rc-admin/psap-prospects" icon="📡" />
          <ShortcutTile label="Features Catalog" href="/sales/features-catalog" icon="🏷️" />
          <ShortcutTile label="Grant Writer" href="/rc-admin/grants" icon="🏛️" />
          <ShortcutTile label="Events & Outreach" href="/rc-admin/marketing/events" icon="📅" />
          <ShortcutTile label="My Contact Card" href="/rc-admin/profile/business-card" icon="👤" />
        </div>
      </div>
    </div>
  );
}
