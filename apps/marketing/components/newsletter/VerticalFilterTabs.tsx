"use client";

import {
  VERTICAL_COLORS,
  VERTICAL_LABELS,
  type Vertical,
} from "@/lib/newsletter/newsletter-data";

export type VerticalFilter = Vertical | "all";

const TABS: { id: VerticalFilter; label: string }[] = [
  { id: "all", label: "All Issues" },
  { id: "psap", label: VERTICAL_LABELS.psap },
  { id: "campus", label: VERTICAL_LABELS.campus },
  { id: "transit", label: VERTICAL_LABELS.transit },
  { id: "venue", label: VERTICAL_LABELS.venue },
];

export function VerticalFilterTabs({
  value,
  onChange,
}: {
  value: VerticalFilter;
  onChange: (v: VerticalFilter) => void;
}) {
  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      role="tablist"
      aria-label="Filter by vertical"
    >
      {TABS.map((tab) => {
        const active = value === tab.id;
        const color = tab.id === "all" ? "#1565C0" : VERTICAL_COLORS[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className="shrink-0 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors"
            style={
              active
                ? { background: color, borderColor: color, color: "#fff" }
                : { background: "transparent", borderColor: "#334155", color: "#CFD8DC" }
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
