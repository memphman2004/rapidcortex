"use client";

import { intentFitBadgeClass } from "@/lib/rapid-iq/scoring";

export function DualScoreBadge({
  intent,
  fit,
}: {
  intent: number;
  fit: number;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <div
        className={`flex h-9 w-11 flex-col items-center justify-center rounded-md border ${intentFitBadgeClass(intent)}`}
        title={`Buying intent ${intent}`}
      >
        <span className="text-[8px] font-bold uppercase leading-none tracking-wide opacity-80">Int</span>
        <span className="text-sm font-bold leading-none">{intent}</span>
      </div>
      <div
        className={`flex h-9 w-11 flex-col items-center justify-center rounded-md border ${intentFitBadgeClass(fit)}`}
        title={`Product fit ${fit}`}
      >
        <span className="text-[8px] font-bold uppercase leading-none tracking-wide opacity-80">Fit</span>
        <span className="text-sm font-bold leading-none">{fit}</span>
      </div>
    </div>
  );
}
