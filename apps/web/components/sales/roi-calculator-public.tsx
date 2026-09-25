"use client";

import { useMemo, useState } from "react";
import type { RoiInputs } from "rapid-cortex-shared";
import { computeRoiSavings } from "@/lib/sales/roi-math";

type Props = { initial: RoiInputs };

/** Public ROI — savings only, never plan costs. */
export function RoiCalculatorPublic({ initial }: Props) {
  const [inputs, setInputs] = useState<RoiInputs>(initial);
  const preview = useMemo(() => computeRoiSavings(inputs), [inputs]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-white">NexCort iQ — Savings preview</h1>
        <p className="mt-2 text-sm text-slate-400">
          Estimated operational savings for {inputs.agencyName || "your agency"}. Adjust inputs to
          model your center.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["callVolume", "Annual call volume"],
            ["seatCount", "Seats"],
            ["languageLineCostDollars", "Language line $/yr"],
            ["qaCostDollars", "QA cost $/yr"],
            ["avgCallTimeSec", "Avg call seconds"],
            ["dispatcherHourlyRate", "Dispatcher hourly $"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-xs text-slate-400">
            {label}
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-white"
              value={inputs[key]}
              onChange={(e) =>
                setInputs((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))
              }
            />
          </label>
        ))}
      </div>
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
        <div className="text-xs font-bold uppercase text-sky-400">Estimated annual savings</div>
        <div className="mt-2 text-3xl font-semibold text-white">
          ${preview.totalAnnualSavings.toLocaleString()}
        </div>
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          <li>Language: ${preview.annualLanguageSavings.toLocaleString()}</li>
          <li>QA: ${preview.annualQaSavings.toLocaleString()}</li>
          <li>Admin time: ${preview.annualAdminTimeSavings.toLocaleString()}</li>
        </ul>
      </div>
    </div>
  );
}
