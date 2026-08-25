"use client";

import {
  PROCUREMENT_STAGE_LABELS,
  resolveProcurementStage,
  type RapidIqPipelineSignal,
} from "rapid-cortex-shared";

export function ProcurementStageBadge({ signal }: { signal: RapidIqPipelineSignal }) {
  const stage = resolveProcurementStage(signal);
  const meta = PROCUREMENT_STAGE_LABELS[stage];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  );
}
