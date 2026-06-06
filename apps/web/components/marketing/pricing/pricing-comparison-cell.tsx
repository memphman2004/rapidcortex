import type { ComparisonCell } from "@/lib/marketing/pricing-content";
import { IconCheck, IconDash } from "./pricing-icons";

const LABELS: Record<ComparisonCell, string> = {
  full: "Included",
  limited: "Included with limits",
  addon: "Available as add-on",
  none: "Not in base tier",
};

export function PricingComparisonCell({ value, note }: { value: ComparisonCell; note?: string }) {
  const label = LABELS[value];

  if (value === "none") {
    return (
      <div className="flex justify-center sm:justify-start" title={label}>
        <span className="sr-only">{label}</span>
        <IconDash className="text-base" />
      </div>
    );
  }

  if (value === "full") {
    return (
      <div className="flex items-center justify-center gap-2 sm:justify-start" title={label}>
        <IconCheck className="h-[18px] w-[18px] shrink-0" />
        <span className="sr-only">{label}</span>
        <span className="hidden text-xs text-slate-400 xl:inline">Included</span>
      </div>
    );
  }

  if (value === "limited") {
    return (
      <div className="flex flex-col items-center gap-1 sm:items-start">
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:justify-start">
          <IconCheck className="h-[18px] w-[18px] shrink-0" />
          <span className="rounded border border-amber-500/35 bg-amber-950/40 px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-amber-200/95">
            Limited
          </span>
          <span className="sr-only">{label}</span>
        </div>
        {note ? <span className="text-[10px] text-slate-500 sm:text-left">{note}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start" title={label}>
      <span className="rounded border border-sky-500/35 bg-sky-950/35 px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-sky-200/95">
        Add-on
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
