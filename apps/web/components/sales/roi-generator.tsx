"use client";

import { useMemo, useState } from "react";
import type { RoiInputs, RoiVertical } from "rapid-cortex-shared";
import { verticalLabelForSales } from "rapid-cortex-shared";
import { computeRoiSavings } from "@/lib/sales/roi-math";

const VERTICALS: RoiVertical[] = ["rc911", "campus", "venue", "hospital", "transit"];

export function RoiGenerator() {
  const [inputs, setInputs] = useState<RoiInputs>({
    agencyName: "",
    vertical: "rc911",
    callVolume: 3000,
    seatCount: 10,
    languageLineCostDollars: 48000,
    qaCostDollars: 24000,
    avgCallTimeSec: 180,
    dispatcherHourlyRate: 32,
  });
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => computeRoiSavings(inputs), [inputs]);

  async function createLink() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/roi", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { url?: string; roiToken?: string };
      const url = data.url ?? (data.roiToken ? `/roi/${data.roiToken}` : null);
      setLink(url);
    } catch {
      setError("Could not create shareable link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-white/5 bg-[#0a1628] p-4">
        {(
          [
            ["agencyName", "Agency name", "text"],
            ["callVolume", "Call volume / year", "number"],
            ["seatCount", "Seats", "number"],
            ["languageLineCostDollars", "Language line $/yr", "number"],
            ["qaCostDollars", "QA cost $/yr", "number"],
            ["avgCallTimeSec", "Avg call time (sec)", "number"],
            ["dispatcherHourlyRate", "Dispatcher hourly $", "number"],
          ] as const
        ).map(([key, label, type]) => (
          <label key={key} className="block text-xs text-slate-400">
            {label}
            <input
              type={type}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
              value={inputs[key] as string | number}
              onChange={(e) =>
                setInputs((prev) => ({
                  ...prev,
                  [key]:
                    type === "number" ? Number(e.target.value) || 0 : e.target.value,
                }))
              }
            />
          </label>
        ))}
        <label className="block text-xs text-slate-400">
          Vertical
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
            value={inputs.vertical}
            onChange={(e) =>
              setInputs((prev) => ({ ...prev, vertical: e.target.value as RoiVertical }))
            }
          >
            {VERTICALS.map((v) => (
              <option key={v} value={v}>
                {verticalLabelForSales(v)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createLink()}
          className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300 disabled:opacity-50"
        >
          Generate shareable link
        </button>
        {error && <p className="text-xs text-red-300">{error}</p>}
        {link && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200">
            <div className="truncate">{link}</div>
            <button
              type="button"
              className="mt-1 font-semibold underline"
              onClick={() => void navigator.clipboard.writeText(link.startsWith("http") ? link : `${window.location.origin}${link}`)}
            >
              Copy URL
            </button>
          </div>
        )}
      </div>
      <div className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
        <h3 className="text-sm font-semibold text-white">Internal savings preview</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li>Language savings: ${preview.annualLanguageSavings.toLocaleString()}/yr</li>
          <li>QA savings: ${preview.annualQaSavings.toLocaleString()}/yr</li>
          <li>Admin time savings: ${preview.annualAdminTimeSavings.toLocaleString()}/yr</li>
          <li className="font-semibold text-sky-300">
            Total: ${preview.totalAnnualSavings.toLocaleString()}/yr
          </li>
          <li className="text-xs text-slate-500">
            Suggested plan (internal): {preview.recommendedPlan}
          </li>
        </ul>
      </div>
    </div>
  );
}
