"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { ExteriorLayerId } from "rapid-cortex-shared";
import { EXTERIOR_LAYER_LABELS } from "@/lib/venue/operational-awareness/layers";
import { C } from "@/lib/theme/rc-theme-tokens";

const LEGEND_SWATCH: Partial<Record<ExteriorLayerId, string>> = {
  incidents: "#ef4444",
  security: "#a78bfa",
  ems: "#f87171",
  police: "#60a5fa",
  fire: "#f97316",
  cameras: "#3b82f6",
  entrances: "#22c55e",
  staging: "#f59e0b",
  roadClosures: "#fbbf24",
};

export function ExteriorMapLegend({
  configured,
  visible,
  onToggle,
}: {
  configured: readonly ExteriorLayerId[];
  visible: ReadonlySet<string>;
  onToggle: (id: ExteriorLayerId) => void;
}) {
  const [open, setOpen] = useState(true);
  if (configured.length === 0) return null;

  return (
    <div
      className="absolute bottom-10 left-3 z-20 max-w-[220px] rounded-md border shadow-md"
      style={{ background: C.card, borderColor: C.border }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        Legend
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
      {open ? (
        <ul className="space-y-1 px-2.5 pb-2" aria-label="Area map layers">
          {configured.map((id) => (
            <li key={id}>
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  className="accent-orange-500"
                  checked={visible.has(id)}
                  onChange={() => onToggle(id)}
                />
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: LEGEND_SWATCH[id] ?? "#94a3b8" }}
                  aria-hidden
                />
                {EXTERIOR_LAYER_LABELS[id]}
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
