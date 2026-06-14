"use client";

import type { AggregateConfidence } from "rapid-cortex-shared";

const STATUS_BAR: Record<string, string> = {
  COMPLETE: "bg-emerald-500",
  PARTIAL: "bg-amber-500",
  INCOMPLETE: "bg-red-500",
  CONFLICTED: "bg-violet-500",
};

const STATUS_TEXT: Record<string, string> = {
  COMPLETE: "text-emerald-400",
  PARTIAL: "text-amber-400",
  INCOMPLETE: "text-red-400",
  CONFLICTED: "text-violet-400",
};

export function ConfidenceMiniBar({ aggregate }: { aggregate: AggregateConfidence }) {
  const barColor = STATUS_BAR[aggregate.pictureStatus] ?? "bg-slate-500";
  const textColor = STATUS_TEXT[aggregate.pictureStatus] ?? "text-slate-400";

  return (
    <div className="flex items-center gap-1.5" title={`Picture: ${aggregate.pictureStatus}`}>
      <div className="h-0.5 w-[60px] overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${barColor}`}
          style={{ width: `${aggregate.overallScore}%` }}
        />
      </div>
      <span className={`min-w-[28px] text-[10px] font-bold tabular-nums ${textColor}`}>
        {aggregate.overallScore}%
      </span>
      {aggregate.criticalGaps > 0 ? (
        <span className="rounded bg-red-500/15 px-1 py-px text-[8px] font-bold tracking-wide text-red-400">
          {aggregate.criticalGaps} GAP{aggregate.criticalGaps > 1 ? "S" : ""}
        </span>
      ) : null}
    </div>
  );
}
