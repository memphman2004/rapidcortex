"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import {
  PRODUCT_MARKETS,
  PRODUCT_MARKET_LABELS,
  MARKETING_ZONE_IDS,
  type MarketingDashboardFilter,
  serializeMarketingDashboardFilter,
} from "rapid-cortex-shared";

const ZONE_LABELS: Record<string, string> = {
  "zone-1": "Zone 1",
  "zone-2": "Zone 2",
  "zone-3": "Zone 3",
  "zone-4": "Zone 4",
  "zone-5": "Zone 5",
  "zone-6": "Zone 6",
};

type Props = {
  filter: MarketingDashboardFilter;
  /** Show all six zones (default) or restrict to 1-4 for reps */
  showAllZones?: boolean;
};

export function MarketingFilterBar({ filter, showAllZones = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (updates: Partial<MarketingDashboardFilter>) => {
      const next = { ...filter, ...updates };
      // Remove undefined / empty values
      for (const key of Object.keys(next) as (keyof MarketingDashboardFilter)[]) {
        if (next[key] === undefined || next[key] === "") delete next[key];
      }
      const qs = serializeMarketingDashboardFilter(next);
      const str = qs.toString();
      router.replace(`${pathname}${str ? `?${str}` : ""}`);
    },
    [filter, pathname, router],
  );

  const zones = showAllZones
    ? MARKETING_ZONE_IDS
    : (["zone-1", "zone-2", "zone-3", "zone-4"] as const);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0a1628] px-4 py-3">
      {/* Product Market */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Market
        </span>
        <button
          onClick={() => update({ productMarket: undefined })}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !filter.productMarket
              ? "bg-sky-600 text-white"
              : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200"
          }`}
        >
          All
        </button>
        {PRODUCT_MARKETS.map((m) => (
          <button
            key={m}
            onClick={() => update({ productMarket: filter.productMarket === m ? undefined : m })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter.productMarket === m
                ? "bg-sky-600 text-white"
                : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200"
            }`}
          >
            {PRODUCT_MARKET_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-white/[0.08]" />

      {/* Sales Zone */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Zone
        </span>
        <button
          onClick={() => update({ zoneId: undefined })}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !filter.zoneId
              ? "bg-violet-600 text-white"
              : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200"
          }`}
        >
          All
        </button>
        {zones.map((z) => (
          <button
            key={z}
            onClick={() => update({ zoneId: filter.zoneId === z ? undefined : z })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter.zoneId === z
                ? "bg-violet-600 text-white"
                : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200"
            }`}
          >
            {ZONE_LABELS[z] ?? z}
          </button>
        ))}
      </div>

      {/* Clear all when any filter is active */}
      {(filter.productMarket || filter.zoneId || filter.state || filter.agencyType || filter.campaign || filter.assignedTo || filter.product) && (
        <>
          <div className="h-5 w-px bg-white/[0.08]" />
          <button
            onClick={() => router.replace(pathname)}
            className="rounded-full px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
          >
            Clear filters
          </button>
        </>
      )}
    </div>
  );
}
