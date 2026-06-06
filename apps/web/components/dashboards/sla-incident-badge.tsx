"use client";

import type { SlaStatus } from "rapid-cortex-shared";
import { formatElapsed, slaTone } from "@/lib/sla-display";

export function SlaIncidentBadge({ sla }: { sla: SlaStatus }) {
  const tone = slaTone(sla.answerSlaStatus, sla.dispatchSlaStatus);
  const elapsed = formatElapsed(sla.answerElapsedSeconds);
  const className =
    tone === "breach"
      ? "animate-pulse bg-rose-950/90 text-rose-100 ring-rose-700"
      : tone === "warning"
        ? "bg-amber-950/80 text-amber-100 ring-amber-800"
        : "bg-emerald-950/70 text-emerald-100 ring-emerald-800";

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ring-1 ${className}`}
      title={`Answer SLA: ${sla.answerSlaStatus}; dispatch: ${sla.dispatchSlaStatus}`}
    >
      {elapsed}
    </span>
  );
}
