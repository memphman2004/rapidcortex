"use client";

import type { HospitalCapacity } from "rapid-cortex-shared";

export function CurrentStatusPanel({ currentCapacity }: { currentCapacity: HospitalCapacity | null }) {
  if (!currentCapacity) {
    return (
      <div className="rounded-lg bg-slate-900 p-6">
        <h3 className="mb-2 text-lg font-semibold text-white">Current status</h3>
        <p className="text-sm text-slate-400">No capacity data yet</p>
      </div>
    );
  }

  const { availability, diversion, waitTimes, staffing, timestamp } = currentCapacity;
  const erAvailable = availability.erBeds.available;

  const statusLabel = diversion.isOnDiversion
    ? "On diversion"
    : erAvailable > 3
      ? "Accepting patients"
      : "Limited capacity";
  const statusClass = diversion.isOnDiversion
    ? "border-red-500 bg-red-950/30 text-red-300"
    : erAvailable > 3
      ? "border-emerald-500 bg-emerald-950/30 text-emerald-300"
      : "border-amber-500 bg-amber-950/30 text-amber-300";

  return (
    <div className="space-y-4 rounded-lg bg-slate-900 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Current status</h3>
        <span className="text-xs text-slate-500">{new Date(timestamp).toLocaleString()}</span>
      </div>
      <p className={`rounded-lg border-2 px-4 py-6 text-center text-lg font-bold ${statusClass}`}>
        {statusLabel}
      </p>
      <StatRow
        label="ER beds"
        value={`${availability.erBeds.available}/${availability.erBeds.total}`}
        tone={erAvailable > 3 ? "good" : erAvailable > 0 ? "warn" : "bad"}
      />
      <StatRow
        label="ICU beds"
        value={`${availability.icuBeds.available}/${availability.icuBeds.total}`}
        tone={
          availability.icuBeds.available > 2
            ? "good"
            : availability.icuBeds.available > 0
              ? "warn"
              : "bad"
        }
      />
      <StatRow
        label="Wait time"
        value={`${waitTimes.erWaitMinutes} min`}
        tone={waitTimes.erWaitMinutes < 30 ? "good" : waitTimes.erWaitMinutes < 60 ? "warn" : "bad"}
      />
      <StatRow
        label="Staffing"
        value={staffing.adequateStaffing ? "Adequate" : "Limited"}
        tone={staffing.adequateStaffing ? "good" : "warn"}
      />
    </div>
  );
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "bad";
}) {
  const colors = {
    good: "text-emerald-400",
    warn: "text-amber-400",
    bad: "text-red-400",
  };
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${colors[tone]}`}>{value}</span>
    </div>
  );
}
