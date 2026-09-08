"use client";

import { type PsapAvailabilityNotice as Notice } from "rapid-cortex-shared";

const TONE: Record<Notice["status"], string> = {
  available: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  after_hours: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  not_on_rapid_cortex: "border-rose-500/25 bg-rose-500/10 text-rose-200",
  unknown: "border-slate-600 bg-slate-900 text-slate-300",
};

export function PSAPAvailabilityNotice({
  notice,
  compact = false,
}: {
  notice: Notice;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${TONE[notice.status]}`}>
      <p className={`font-semibold ${compact ? "text-[11px]" : "text-[12px]"}`}>{notice.headline}</p>
      <p className={`mt-0.5 leading-relaxed ${compact ? "text-[10px] opacity-80" : "text-[11px] opacity-90"}`}>
        {notice.body}
      </p>
    </div>
  );
}
