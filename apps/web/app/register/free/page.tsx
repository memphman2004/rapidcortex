"use client";

import { useState } from "react";
import type { RoiVertical } from "rapid-cortex-shared";
import { verticalLabelForSales } from "rapid-cortex-shared";

export default function FreeRegisterPage() {
  const [offerId, setOfferId] = useState<
    "community_tip_line" | "agency_intelligence_scan" | "dispatcher_wellness"
  >("community_tip_line");
  const [agencyName, setAgencyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [vertical, setVertical] = useState<RoiVertical>("campus");
  const [state, setState] = useState("");
  const [tipForwardEmail, setTipForwardEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/sales/register/free", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId,
        agencyName,
        contactName,
        contactEmail,
        vertical,
        state,
        tipForwardEmail: tipForwardEmail || undefined,
      }),
    });
    if (!res.ok) {
      setError("Could not submit registration. Check fields and try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] px-4">
        <div className="max-w-md rounded-2xl border border-emerald-500/20 bg-[#0a1628] p-6 text-center">
          <h1 className="text-xl font-semibold text-white">You&apos;re registered</h1>
          <p className="mt-2 text-sm text-slate-400">
            Thanks — our team will follow up to activate your free offering. This is not a free
            trial; qualifying free offerings stay available without a countdown clock.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] px-4 py-12">
      <form
        onSubmit={(e) => void submit(e)}
        className="mx-auto max-w-lg space-y-4 rounded-2xl border border-white/5 bg-[#0a1628] p-6"
      >
        <h1 className="text-xl font-semibold text-white">NexCort iQ — Free offerings</h1>
        <p className="text-sm text-slate-400">
          Register for Community Connect, a complimentary Operational Intelligence Report, or
          Wellness. No credit card.
        </p>
        <label className="block text-xs text-slate-400">
          Offering
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-white"
            value={offerId}
            onChange={(e) => setOfferId(e.target.value as typeof offerId)}
          >
            <option value="community_tip_line">Community Connect (Campus / Venue) — Free</option>
            <option value="agency_intelligence_scan">
              Operational Intelligence Report — Free (limited)
            </option>
            <option value="dispatcher_wellness">Dispatcher Wellness (PSAP) — Free</option>
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Agency name
          <input
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-white"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Your name
          <input
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-white"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Work email
          <input
            required
            type="email"
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-white"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Vertical
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-white"
            value={vertical}
            onChange={(e) => setVertical(e.target.value as RoiVertical)}
          >
            {(["rc911", "campus", "venue", "hospital", "transit"] as RoiVertical[]).map((v) => (
              <option key={v} value={v}>
                {verticalLabelForSales(v)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          State
          <input
            required
            maxLength={2}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-white"
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase())}
          />
        </label>
        {offerId === "community_tip_line" && (
          <label className="block text-xs text-slate-400">
            Tip forward email
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-white"
              value={tipForwardEmail}
              onChange={(e) => setTipForwardEmail(e.target.value)}
            />
          </label>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg border border-sky-500/40 bg-sky-500/10 py-2.5 text-sm font-bold text-sky-300"
        >
          Register
        </button>
      </form>
    </div>
  );
}
