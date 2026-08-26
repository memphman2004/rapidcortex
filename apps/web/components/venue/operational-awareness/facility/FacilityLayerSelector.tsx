"use client";

import type { FacilityLayerId } from "rapid-cortex-shared";
import { FACILITY_LAYER_LABELS } from "@/lib/venue/operational-awareness/layers";
import { C } from "@/lib/theme/rc-theme-tokens";

export function FacilityLayerSelector({
  configured,
  visible,
  onToggle,
}: {
  configured: readonly FacilityLayerId[];
  visible: ReadonlySet<string>;
  onToggle: (id: FacilityLayerId) => void;
}) {
  return (
    <div
      className="absolute right-3 top-24 z-20 w-[180px] rounded-md border p-2 shadow-md"
      style={{ background: C.card, borderColor: C.border }}
      aria-label="Facility map layers"
    >
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Map Layers</div>
      <ul className="space-y-1">
        {configured.map((id) => (
          <li key={id}>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                className="accent-orange-500"
                checked={visible.has(id)}
                onChange={() => onToggle(id)}
              />
              {FACILITY_LAYER_LABELS[id]}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
