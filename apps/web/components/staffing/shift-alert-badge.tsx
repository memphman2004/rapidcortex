"use client";

import type { RiskLevel, ShiftForecast } from "rapid-cortex-shared/staffing";

function riskTone(level: RiskLevel): string {
  switch (level) {
    case "CRITICAL":
      return "text-red-300 border-red-500/40 bg-red-500/10";
    case "HIGH":
      return "text-amber-300 border-amber-500/40 bg-amber-500/10";
    case "LOW":
      return "text-sky-300 border-sky-500/40 bg-sky-500/10";
    default:
      return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  }
}

function formatShiftHours(start: number, end: number): string {
  const fmt = (h: number) => `${h.toString().padStart(2, "0")}:00`;
  return end < start ? `${fmt(start)}–${fmt(end)} (+1)` : `${fmt(start)}–${fmt(end)}`;
}

export function ShiftAlertBadge({ shift }: { shift: ShiftForecast | null }) {
  if (!shift || (shift.riskLevel !== "CRITICAL" && shift.riskLevel !== "HIGH")) return null;

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${riskTone(shift.riskLevel)}`}
      title={shift.riskReason}
    >
      <span className="font-bold uppercase tracking-wide">{shift.riskLevel} staffing alert</span>
      <span className="mx-2 opacity-60">·</span>
      <span>
        {shift.date} {formatShiftHours(shift.shiftStart, shift.shiftEnd)} — recommend{" "}
        {shift.recommendedDispatchers} dispatchers
        {shift.currentScheduledDispatchers != null
          ? ` (scheduled: ${shift.currentScheduledDispatchers})`
          : ""}
      </span>
    </div>
  );
}
