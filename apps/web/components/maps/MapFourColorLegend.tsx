"use client";

import { REGION_COLORS } from "@/lib/map/region-colors";

const LABELS = ["Active agency", "Adjacent region", "Adjacent region", "Adjacent region"] as const;

/**
 * Explains that coverage fills are positional (four-color), not status/tier.
 */
export function MapFourColorLegend({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute bottom-8 right-3 z-10 rounded-lg border border-white/[0.08] bg-[rgba(10,9,20,0.85)] px-3 py-2 text-[11px] text-white/50 backdrop-blur-sm ${className}`}
      role="note"
      aria-label="Coverage area color legend"
    >
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/30">
        Coverage Areas
      </div>
      {LABELS.map((label, i) => (
        <div key={i} className="mb-1 flex items-center gap-2 last:mb-0">
          <div
            className="h-3 w-3 shrink-0 rounded-[3px]"
            style={{
              background: REGION_COLORS[i].fill,
              border: `1px solid ${REGION_COLORS[i].border}`,
            }}
          />
          <span>{label}</span>
        </div>
      ))}
      <div className="mt-1.5 text-[10px] text-white/20">Colors indicate position only</div>
    </div>
  );
}
