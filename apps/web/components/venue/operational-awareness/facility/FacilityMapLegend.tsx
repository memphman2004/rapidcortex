"use client";

import { C } from "@/lib/theme/rc-theme-tokens";

const ITEMS = [
  { label: "Camera", color: "#3b82f6" },
  { label: "Incident", color: "#ef4444" },
  { label: "Access Point", color: "#22c55e" },
  { label: "AED", color: "#a78bfa" },
  { label: "Stair / Escalator", color: "#f59e0b" },
] as const;

export function FacilityMapLegend() {
  return (
    <div
      className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-md border px-3 py-1.5"
      style={{ background: C.card, borderColor: C.border }}
      aria-label="Facility marker legend"
    >
      {ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-300">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
