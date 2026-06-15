"use client";

import type { WeeklyStaffingForecast } from "rapid-cortex-shared/staffing";
import { useStaffingForecast } from "./use-staffing-forecast";
import { ShiftAlertBadge } from "./shift-alert-badge";

function riskCellClass(level: string): string {
  switch (level) {
    case "CRITICAL":
      return "bg-red-950/40 text-red-200";
    case "HIGH":
      return "bg-amber-950/40 text-amber-200";
    case "LOW":
      return "bg-sky-950/30 text-sky-200";
    default:
      return "bg-[#0b1118] text-slate-200";
  }
}

function ForecastGrid({ forecast }: { forecast: WeeklyStaffingForecast }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#182334]">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[#07090e] text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Shift</th>
            <th className="px-3 py-2">Predicted volume</th>
            <th className="px-3 py-2">Recommended</th>
            <th className="px-3 py-2">Scheduled</th>
            <th className="px-3 py-2">Risk</th>
          </tr>
        </thead>
        <tbody>
          {forecast.shifts.map((shift) => (
            <tr key={`${shift.date}-${shift.shiftStart}`} className="border-t border-[#182334]">
              <td className="px-3 py-2 font-mono text-slate-300">{shift.date}</td>
              <td className="px-3 py-2 text-slate-400">
                {String(shift.shiftStart).padStart(2, "0")}:00–{String(shift.shiftEnd).padStart(2, "0")}:00
              </td>
              <td className="px-3 py-2">
                {shift.predictedCallVolume}
                <span className="text-slate-500">
                  {" "}
                  ({shift.confidenceRange[0]}–{shift.confidenceRange[1]})
                </span>
              </td>
              <td className="px-3 py-2 font-semibold text-white">{shift.recommendedDispatchers}</td>
              <td className="px-3 py-2 text-slate-400">
                {shift.currentScheduledDispatchers ?? "—"}
              </td>
              <td className={`px-3 py-2 font-semibold ${riskCellClass(shift.riskLevel)}`}>
                {shift.riskLevel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StaffingForecastPanel({ enabled }: { enabled: boolean }) {
  const { forecast, isLoading, isError } = useStaffingForecast(enabled);

  if (!enabled) return null;

  return (
    <section className="rounded-xl border border-[#182334] bg-[#07090e]/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Predictive staffing — 7-day forecast</h2>
          <p className="text-[11px] text-slate-500">
            Call-volume patterns · supervisor briefing · refreshes hourly
          </p>
        </div>
        {forecast ? (
          <span className="text-[10px] text-slate-500">
            Generated {new Date(forecast.generatedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading staffing forecast…</p>
      ) : isError ? (
        <p className="text-sm text-red-300">Could not load staffing forecast.</p>
      ) : !forecast ? (
        <p className="text-sm text-slate-400">
          No forecast yet. Enable agency staffing config and run generate, or wait for the weekly schedule.
        </p>
      ) : (
        <>
          <ShiftAlertBadge shift={forecast.weekSummary.peakRiskShift} />
          {forecast.weekSummary.dataQualityNote ? (
            <p className="mt-2 text-[11px] text-amber-200/90">{forecast.weekSummary.dataQualityNote}</p>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Stat label="Avg recommended" value={String(Math.round(forecast.weekSummary.avgRecommended))} />
            <Stat
              label="Critical shifts"
              value={String(forecast.weekSummary.criticalShiftCount)}
            />
            <Stat label="Model" value={forecast.modelUsed} />
          </div>
          <div className="mt-4">
            <ForecastGrid forecast={forecast} />
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#182334] bg-[#0b1118] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-white" title={value}>
        {value}
      </p>
    </div>
  );
}
