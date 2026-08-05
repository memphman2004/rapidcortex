"use client";

import type { PsapProspectStats } from "rapid-cortex-shared";

type Props = {
  stats: PsapProspectStats | undefined;
  isLoading?: boolean;
};

function formatCents(cents: number): string {
  if (!cents) return "$0";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="min-w-[120px] flex-1 border-r border-[#1e2130] px-4 py-3 last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${accent ?? "text-[#e2e8f0]"}`}>
        {value}
      </p>
    </div>
  );
}

export function PsapStatsStrip({ stats, isLoading }: Props) {
  if (isLoading || !stats) {
    return (
      <div className="flex animate-pulse overflow-hidden rounded-lg border border-[#1e2130] bg-[#0f1117]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-[#1e2130] px-4 py-3 last:border-r-0">
            <div className="h-3 w-16 rounded bg-slate-800" />
            <div className="mt-2 h-6 w-12 rounded bg-slate-800" />
          </div>
        ))}
      </div>
    );
  }

  const engagedPlus =
    (stats.byStatus.ENGAGED ?? 0) +
    (stats.byStatus.DEMO_SCHEDULED ?? 0) +
    (stats.byStatus.PILOT ?? 0) +
    (stats.byStatus.CUSTOMER ?? 0);

  return (
    <div className="flex flex-wrap overflow-hidden rounded-lg border border-[#1e2130] bg-[#0f1117]">
      <Cell label="Total" value={stats.total.toLocaleString()} />
      <Cell
        label="Uncontacted"
        value={(stats.byStatus.UNCONTACTED ?? 0).toLocaleString()}
        accent="text-slate-400"
      />
      <Cell label="Engaged+" value={engagedPlus.toLocaleString()} accent="text-amber-300" />
      <Cell label="With Address" value={stats.withAddress.toLocaleString()} accent="text-sky-300" />
      <Cell
        label="Est. Pipeline"
        value={`${formatCents(stats.totalEstimatedValue)} ARR`}
        accent="text-emerald-300"
      />
    </div>
  );
}
