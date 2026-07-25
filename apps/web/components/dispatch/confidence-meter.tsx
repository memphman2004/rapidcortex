"use client";

import { confidenceToDisplayPercent } from "rapid-cortex-shared";

function bandForPercent(pct: number): {
  level: "HIGH" | "MED" | "LOW";
  barClass: string;
  labelClass: string;
} {
  if (pct >= 75) {
    return {
      level: "HIGH",
      barClass: "bg-gradient-to-r from-emerald-700 to-emerald-400",
      labelClass: "text-emerald-300",
    };
  }
  if (pct >= 45) {
    return {
      level: "MED",
      barClass: "bg-gradient-to-r from-amber-700 to-amber-400",
      labelClass: "text-amber-300",
    };
  }
  return {
    level: "LOW",
    barClass: "bg-gradient-to-r from-rose-800 to-rose-500",
    labelClass: "text-rose-300",
  };
}

export function ConfidenceMeter({
  value01,
  label = "Confidence",
}: {
  /** Normalized 0–1 (same as persisted `AIAnalysis.confidence`); also tolerates 0–100. */
  value01: number;
  label?: string;
}) {
  const pct = confidenceToDisplayPercent(value01);
  const band = bandForPercent(pct);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-wide text-slate-500"
          title="Model-estimated confidence for this AI triage output (not the same as per-line STT % in the transcript)."
        >
          {label}
        </span>
        <span className={`text-xs font-semibold tabular-nums ${band.labelClass}`}>
          {pct}% · {band.level}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700/80"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${label} ${pct} percent, ${band.level}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${band.barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
