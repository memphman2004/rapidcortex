"use client";

export function ConfidenceMeter({
  value01,
  label = "Confidence",
}: {
  /** Normalized 0–1 (same as persisted `AIAnalysis.confidence`). */
  value01: number;
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value01)) * 100);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-wide text-slate-500"
          title="Model-estimated confidence for this AI triage output (not the same as per-line STT % in the transcript)."
        >
          {label}
        </span>
        <span className="text-xs font-semibold tabular-nums text-slate-200">{pct}%</span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700/80"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${label} ${pct} percent`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-700 to-sky-400 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
