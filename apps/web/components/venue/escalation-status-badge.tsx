"use client";

import type { EscalationStatus } from "rapid-cortex-shared";

const STYLES: Record<EscalationStatus, string> = {
  pending: "bg-amber-500/20 text-amber-300 ring-amber-500/30",
  acknowledged: "bg-sky-500/20 text-sky-300 ring-sky-500/30",
  active: "bg-rose-500/20 text-rose-300 ring-rose-500/30",
  resolved: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 ring-slate-500/30",
};

export function EscalationStatusBadge({ status }: { status: EscalationStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${STYLES[status]}`}>
      {status}
    </span>
  );
}
