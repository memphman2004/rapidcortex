"use client";

/**
 * NEXiQ Workload Savings Calculator
 *
 * Estimates the non-emergency call workload that agencies might address with
 * NEXiQ automation. All results are illustrative estimates based on user inputs
 * and are not guaranteed outcomes, staff reductions, or validated operating results.
 */

import { useState, useCallback } from "react";

const DEFAULT_MARKETING_LEAD_URL =
  "https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com/api/marketing/lead";

function marketingLeadSubmitUrl(): string {
  const override =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_MARKETING_LEAD_URL?.trim() ?? "")
      : "";
  return override || DEFAULT_MARKETING_LEAD_URL;
}

type CalcInputs = {
  monthlyNonEmergencyCalls: string;
  avgHandlingMinutes: string;
  eligibleCallPct: string;
  automationRate: string;
  hourlyStaffCost: string;
};

type CalcResults = {
  currentMonthlyHours: number;
  addressableMonthlyHours: number;
  estimatedRecoveredHours: number;
  estimatedAnnualCapacityValue: number | null;
  eligibleCalls: number;
};

function parseNum(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
}

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function formatHours(hours: number): string {
  return hours.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function computeResults(inputs: CalcInputs): CalcResults | null {
  const calls = parseNum(inputs.monthlyNonEmergencyCalls);
  const avgMins = parseNum(inputs.avgHandlingMinutes);
  const eligiblePct = clamp(parseNum(inputs.eligibleCallPct), 0, 100) / 100;
  const automationPct = clamp(parseNum(inputs.automationRate), 0, 100) / 100;
  const hourlyCost = parseNum(inputs.hourlyStaffCost);

  if (calls <= 0 || avgMins <= 0) return null;

  const currentMonthlyHours = (calls * avgMins) / 60;
  const eligibleCalls = Math.round(calls * eligiblePct);
  const addressableMonthlyHours = (eligibleCalls * avgMins) / 60;
  const estimatedRecoveredHours = addressableMonthlyHours * automationPct;

  const estimatedAnnualCapacityValue =
    hourlyCost > 0 ? estimatedRecoveredHours * 12 * hourlyCost : null;

  return {
    currentMonthlyHours,
    addressableMonthlyHours,
    estimatedRecoveredHours,
    eligibleCalls,
    estimatedAnnualCapacityValue,
  };
}

type ReportFormState = "idle" | "open" | "sending" | "success" | "error";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY",
  "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50";
const labelCls = "block mb-1 text-xs font-medium text-slate-400";

export function NexiqCalculator() {
  const [inputs, setInputs] = useState<CalcInputs>({
    monthlyNonEmergencyCalls: "",
    avgHandlingMinutes: "8",
    eligibleCallPct: "60",
    automationRate: "55",
    hourlyStaffCost: "",
  });
  const [reportFormState, setReportFormState] = useState<ReportFormState>("idle");
  const [reportForm, setReportForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    state: "",
  });
  const [reportError, setReportError] = useState<string | null>(null);

  const results = computeResults(inputs);

  const handleInput = useCallback(
    (key: keyof CalcInputs) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputs((prev) => ({ ...prev, [key]: e.target.value }));
    },
    [],
  );

  async function submitReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (reportFormState === "sending") return;
    setReportFormState("sending");
    setReportError(null);

    const body = {
      firstName: reportForm.firstName.trim(),
      lastName: reportForm.lastName.trim(),
      email: reportForm.email.trim().toLowerCase(),
      state: reportForm.state,
      referrer:
        typeof window !== "undefined" ? document.referrer || null : null,
      landingPage:
        typeof window !== "undefined" ? window.location.pathname : "/nexiq/savings-calculator",
      capturedAt: new Date().toISOString(),
      utmSource: typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("utm_source") ?? undefined
        : undefined,
      utmMedium: typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("utm_medium") ?? undefined
        : undefined,
      utmCampaign: typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined
        : undefined,
    };

    try {
      const res = await fetch(marketingLeadSubmitUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setReportFormState("success");
      } else {
        const text = await res.text().catch(() => "");
        setReportError(
          text.includes("already") ? "This email has already been registered." : "Unable to submit right now.",
        );
        setReportFormState("error");
      }
    } catch {
      setReportError("Unable to connect. Please try again.");
      setReportFormState("error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-2 inline-block rounded-full bg-sky-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-sky-400">
          NEXiQ — NexCort iQ
        </div>
        <h1 className="mb-3 text-3xl font-bold text-white">
          Non-Emergency Call Workload Estimator
        </h1>
        <p className="mx-auto max-w-xl text-sm text-slate-400">
          Estimate how much dispatcher capacity could be recovered by automating eligible
          non-emergency calls with NEXiQ. Results are illustrative estimates based on your inputs —
          not guaranteed outcomes or validated operating data.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Inputs */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Your Agency's Call Volume
          </h2>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>
                Monthly non-emergency calls *
              </label>
              <input
                type="number"
                className={inputCls}
                placeholder="e.g. 3000"
                min="0"
                value={inputs.monthlyNonEmergencyCalls}
                onChange={handleInput("monthlyNonEmergencyCalls")}
              />
            </div>

            <div>
              <label className={labelCls}>
                Average handling time per call (minutes) *
              </label>
              <input
                type="number"
                className={inputCls}
                placeholder="e.g. 8"
                min="1"
                max="60"
                value={inputs.avgHandlingMinutes}
                onChange={handleInput("avgHandlingMinutes")}
              />
            </div>

            <div>
              <label className={labelCls}>
                Estimated eligible call percentage (%)
              </label>
              <input
                type="number"
                className={inputCls}
                placeholder="e.g. 60"
                min="0"
                max="100"
                value={inputs.eligibleCallPct}
                onChange={handleInput("eligibleCallPct")}
              />
              <p className="mt-1 text-xs text-slate-500">
                % of non-emergency calls that could be handled via automated intake (noise,
                parking, minor property damage, information requests)
              </p>
            </div>

            <div>
              <label className={labelCls}>
                Estimated automation/containment rate (%)
              </label>
              <input
                type="number"
                className={inputCls}
                placeholder="e.g. 55"
                min="0"
                max="100"
                value={inputs.automationRate}
                onChange={handleInput("automationRate")}
              />
              <p className="mt-1 text-xs text-slate-500">
                % of eligible calls fully handled without reaching a dispatcher
              </p>
            </div>

            <div>
              <label className={labelCls}>
                Hourly loaded staff cost (optional, $)
              </label>
              <input
                type="number"
                className={inputCls}
                placeholder="e.g. 45"
                min="0"
                value={inputs.hourlyStaffCost}
                onChange={handleInput("hourlyStaffCost")}
              />
              <p className="mt-1 text-xs text-slate-500">
                Fully loaded hourly cost per dispatcher or call-taker for capacity value estimate
              </p>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Illustrative Estimate
          </h2>

          {!results ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <p className="text-sm text-slate-500">
                Enter your monthly call volume and average handling time to see estimates.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <ResultCard
                label="Current monthly non-emergency workload"
                value={`${formatHours(results.currentMonthlyHours)} hrs / month`}
                sublabel="at the handling time you entered"
              />
              <ResultCard
                label={`Eligible calls (${inputs.eligibleCallPct}%)`}
                value={`${results.eligibleCalls.toLocaleString()} calls / month`}
                sublabel="potentially suitable for automated intake"
              />
              <ResultCard
                label="Addressable workload"
                value={`${formatHours(results.addressableMonthlyHours)} hrs / month`}
                sublabel="time tied to eligible calls"
                accent
              />
              <ResultCard
                label={`Estimated recovered capacity (${inputs.automationRate}% containment)`}
                value={`${formatHours(results.estimatedRecoveredHours)} hrs / month`}
                sublabel="staff hours that may be redirected to other work"
                accent
              />
              {results.estimatedAnnualCapacityValue !== null && (
                <ResultCard
                  label="Illustrative annual capacity value"
                  value={formatCurrency(results.estimatedAnnualCapacityValue)}
                  sublabel="at the hourly cost entered — not a guaranteed saving"
                  accent
                />
              )}

              {/* Disclaimer */}
              <p className="rounded-lg border border-amber-900/30 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-200/70">
                <strong>Disclaimer:</strong> These are illustrative estimates based on your inputs.
                They do not represent guaranteed savings, staff reductions, cost commitments, or
                validated operating outcomes. Actual results depend on call mix, agency policy,
                implementation scope, and other factors specific to your environment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Formula transparency */}
      <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Calculation formula
        </h3>
        <div className="space-y-1 font-mono text-xs text-slate-500">
          <p>Current workload (hrs) = (monthly calls × avg handling mins) ÷ 60</p>
          <p>Eligible calls = monthly calls × eligible call %</p>
          <p>Addressable workload = (eligible calls × avg handling mins) ÷ 60</p>
          <p>Recovered capacity = addressable workload × automation/containment rate</p>
          <p>Annual capacity value = recovered capacity × 12 × hourly loaded cost</p>
        </div>
      </div>

      {/* Report request CTA */}
      <div className="mt-8">
        {reportFormState === "idle" && results && (
          <div className="rounded-2xl border border-sky-900/30 bg-sky-950/20 p-6 text-center">
            <h3 className="mb-2 text-base font-semibold text-sky-200">
              Want a copy of this estimate?
            </h3>
            <p className="mb-4 text-sm text-slate-400">
              Share your contact information and we'll send you a summary of this estimate
              along with information about NEXiQ evaluation options.
            </p>
            <button
              type="button"
              onClick={() => setReportFormState("open")}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              Request estimate report
            </button>
          </div>
        )}

        {(reportFormState === "open" || reportFormState === "sending" || reportFormState === "error") && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <h3 className="mb-4 text-base font-semibold text-white">
              Request your estimate report
            </h3>
            <form onSubmit={submitReport} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First name *</label>
                  <input
                    type="text"
                    className={inputCls}
                    required
                    value={reportForm.firstName}
                    onChange={(e) => setReportForm((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last name *</label>
                  <input
                    type="text"
                    className={inputCls}
                    required
                    value={reportForm.lastName}
                    onChange={(e) => setReportForm((p) => ({ ...p, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Work email *</label>
                <input
                  type="email"
                  className={inputCls}
                  required
                  placeholder="yourname@agency.gov"
                  value={reportForm.email}
                  onChange={(e) => setReportForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>State *</label>
                <select
                  className={inputCls}
                  required
                  value={reportForm.state}
                  onChange={(e) => setReportForm((p) => ({ ...p, state: e.target.value }))}
                >
                  <option value="">Select state…</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {reportError && (
                <p className="rounded-lg border border-red-800/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                  {reportError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={reportFormState === "sending"}
                  className="flex-1 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
                >
                  {reportFormState === "sending" ? "Sending…" : "Send me the estimate"}
                </button>
                <button
                  type="button"
                  onClick={() => setReportFormState("idle")}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-400 hover:border-white/20"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-slate-600">
                By submitting this form you agree that NexCort iQ may contact you about this
                estimate and related products. We do not share your information with third parties
                for marketing purposes.
              </p>
            </form>
          </div>
        )}

        {reportFormState === "success" && (
          <div
            className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-6 py-8 text-center"
            role="status"
          >
            <p className="text-lg font-semibold text-emerald-100">
              We'll be in touch within one business day.
            </p>
            <p className="mt-2 text-sm text-emerald-200/80">
              Thank you for your interest in NEXiQ. A member of our team will follow up with your
              estimate summary and information about evaluation options.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent
          ? "border-sky-800/40 bg-sky-950/30"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <p className="mb-0.5 text-xs text-slate-400">{label}</p>
      <p
        className={`text-lg font-bold ${accent ? "text-sky-300" : "text-white"}`}
      >
        {value}
      </p>
      {sublabel && <p className="mt-0.5 text-xs text-slate-500">{sublabel}</p>}
    </div>
  );
}
