"use client";

import type { VenueLevel } from "rapid-cortex-shared";
import { C } from "@/lib/theme/rc-theme-tokens";

export function FacilityLevelSelector({
  levels,
  activeLevelId,
  onChange,
}: {
  levels: VenueLevel[];
  activeLevelId: string;
  onChange: (id: string) => void;
}) {
  const enabled = levels.filter((level) => level.enabled);
  return (
    <div
      className="flex flex-wrap gap-1"
      role="tablist"
      aria-label="Facility level"
    >
      {enabled.map((level) => {
        const selected = level.id === activeLevelId;
        return (
          <button
            key={level.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(level.id)}
            className={`rounded px-2 py-1 text-[10px] font-bold tracking-wide ${
              selected ? "text-black" : "text-slate-400 hover:text-slate-200"
            }`}
            style={selected ? { background: C.orange } : { background: C.surface, border: `1px solid ${C.border}` }}
          >
            {level.shortName ?? level.name}
          </button>
        );
      })}
    </div>
  );
}
