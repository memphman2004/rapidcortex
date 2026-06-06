"use client";

import { useMemo, useState } from "react";

type Scenario = {
  callsPerMonth: number;
  minutesSavedPerCall: number;
  hourlyLaborCost: number;
  qaReviews: number;
  translationMinutesPerMonth: number;
  cadManualMinutesPerMonth: number;
};

const DEFAULTS: Scenario = {
  callsPerMonth: 120_000,
  minutesSavedPerCall: 0.7,
  hourlyLaborCost: 62,
  qaReviews: 5_400,
  translationMinutesPerMonth: 18_500,
  cadManualMinutesPerMonth: 2_750,
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function RoiCalculatorSandbox() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULTS);

  const estimate = useMemo(() => {
    const dispatcherLaborHours =
      (scenario.callsPerMonth * scenario.minutesSavedPerCall) / 60 + scenario.cadManualMinutesPerMonth / 60;
    const dispatcherLaborSavings = dispatcherLaborHours * scenario.hourlyLaborCost;
    const translationHours = scenario.translationMinutesPerMonth / 60;
    const translationSavings = translationHours * scenario.hourlyLaborCost * 0.35;
    const qaLaborHours = scenario.qaReviews * 0.08;
    const qaLaborSavings = qaLaborHours * scenario.hourlyLaborCost;
    const totalMonthly = dispatcherLaborSavings + translationSavings + qaLaborSavings;
    return {
      dispatcherLaborHours,
      dispatcherLaborSavings,
      translationHours,
      translationSavings,
      qaLaborHours,
      qaLaborSavings,
      totalMonthly,
      annualRoi: totalMonthly * 12,
    };
  }, [scenario]);

  return (
    <div className="mt-10 space-y-8 rounded-[32px] border border-emerald-500/30 bg-black/55 p-6 text-sm text-emerald-100">
      <div className="grid gap-4 md:grid-cols-3">
        {(
          [
            ["callsPerMonth", "911 / ECC calls/month", scenario.callsPerMonth],
            ["minutesSavedPerCall", "Estimated minutes saved/call", scenario.minutesSavedPerCall],
            ["hourlyLaborCost", "Fully loaded dispatcher labor cost/hr", scenario.hourlyLaborCost],
          ] as const
        ).map(([key, label, value]) => (
          <label key={key} className="text-xs text-emerald-200/80">
            {label}
            <input
              type="number"
              min={0}
              step={key === "minutesSavedPerCall" ? 0.05 : key === "hourlyLaborCost" ? 1 : 250}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-white outline-none focus:border-emerald-300"
              value={value}
              onChange={(e) => setScenario((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
            />
          </label>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(
          [
            ["qaReviews", "Monthly QA audits", scenario.qaReviews],
            ["translationMinutesPerMonth", "Interpretation/STT workload (minutes)", scenario.translationMinutesPerMonth],
            ["cadManualMinutesPerMonth", "Monthly CAD reconciliation minutes", scenario.cadManualMinutesPerMonth],
          ] as const
        ).map(([key, label, value]) => (
          <label key={key} className="text-xs text-emerald-200/80">
            {label}
            <input
              type="number"
              min={0}
              step={50}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-white outline-none focus:border-emerald-300"
              value={value}
              onChange={(e) => setScenario((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
            />
          </label>
        ))}
      </div>

      <dl className="grid gap-4 rounded-3xl bg-gradient-to-br from-emerald-500/25 to-transparent p-6 text-base text-emerald-50 md:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">Dispatcher labor uplift</dt>
          <dd className="mt-3 text-lg font-semibold text-white">{formatUsd(estimate.dispatcherLaborSavings)}</dd>
          <dd className="mt-2 text-[11px] text-emerald-100/65">
            {estimate.dispatcherLaborHours.toFixed(1)} hours/month @ ${scenario.hourlyLaborCost}/hr loaded cost.
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">Interpretation uplift</dt>
          <dd className="mt-3 text-lg font-semibold text-white">{formatUsd(estimate.translationSavings)}</dd>
          <dd className="mt-2 text-[11px] text-emerald-100/65">
            Applies a conservative ~35% capture rate on multilingual handling minutes.
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">QA automation uplift</dt>
          <dd className="mt-3 text-lg font-semibold text-white">{formatUsd(estimate.qaLaborSavings)}</dd>
          <dd className="mt-2 text-[11px] text-emerald-100/65">Assumes ~5 minutes saved per audited call.</dd>
        </div>
      </dl>

      <div className="rounded-3xl border border-white/15 bg-black/65 p-6 text-center md:text-left">
        <p className="text-xs uppercase tracking-[0.45em] text-emerald-200/70">Modeled ROI</p>
        <p className="mt-4 text-3xl font-semibold text-white">
          {formatUsd(estimate.totalMonthly)} monthly · {formatUsd(estimate.annualRoi)} modeled annual uplift
        </p>
        <p className="mt-6 text-[11px] text-emerald-100/65">
          Indicative only — plug your agency labor agreements + CAD vendor SLAs during procurement workshops. Financing,
          staffing mix, QA cadence, and translation demand materially change totals.
        </p>
      </div>
    </div>
  );
}
