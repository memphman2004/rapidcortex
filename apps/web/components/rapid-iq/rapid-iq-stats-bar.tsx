"use client";

import type { RapidIqStats } from "@/lib/rapid-iq/types";
import { formatTimeAgo } from "@/lib/rapid-iq/scoring";

function Metric({
  value,
  label,
  sublabel,
  color,
  icon,
}: {
  value: string;
  label: string;
  sublabel: string;
  color: string;
  icon: string;
}) {
  return (
    <div className="flex min-w-[110px] flex-col gap-1 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d1b35] px-4 py-3">
      <div className="flex items-baseline gap-1.5">
        <span className={`text-[12px] opacity-50 ${color}`}>{icon}</span>
        <span className={`text-2xl font-extrabold leading-none tracking-tight tabular-nums ${color}`}>
          {value}
        </span>
      </div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{label}</div>
      <div className="text-[9px] text-slate-700">{sublabel}</div>
    </div>
  );
}

type Props = {
  stats: RapidIqStats;
  lastUpdated?: string | null;
  demo?: boolean;
};

export function RapidIqStatsBar({ stats, lastUpdated, demo }: Props) {
  return (
    <div className="flex flex-wrap items-stretch gap-2 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 py-3">
      <Metric
        value={String(stats.opportunities)}
        label="Opportunities"
        sublabel="Active signals"
        color="text-sky-400"
        icon="◎"
      />
      <Metric
        value={String(stats.rfps)}
        label="RFPs"
        sublabel="Open solicitations"
        color="text-red-400"
        icon="!"
      />
      <Metric
        value={String(stats.competitor)}
        label="Competitor"
        sublabel="Displacement opps"
        color="text-amber-400"
        icon="⚡"
      />
      <Metric
        value={String(stats.grantFunding)}
        label="Grant Funding"
        sublabel="Funding signals"
        color="text-emerald-400"
        icon="$"
      />
      <div className="ml-auto flex flex-col items-end justify-center gap-1 pr-1">
        {lastUpdated && (
          <span className="text-[10px] text-slate-600">
            Last updated {formatTimeAgo(lastUpdated)}
          </span>
        )}
        {demo && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">
            DEMO DATA
          </span>
        )}
      </div>
    </div>
  );
}
