"use client";

import { useMemo, useState } from "react";
import {
  filterSalesFeatureCatalog,
  getSalesFeatureById,
  verticalLabelForSales,
  type QuotePlan,
  type RoiVertical,
} from "rapid-cortex-shared";
import { recommendPlan } from "@/lib/sales/roi-math";

type Props = {
  proposedBy: string;
  defaultLeadAssignee?: string;
};

const VERTICALS: RoiVertical[] = ["rc911", "campus", "venue", "hospital", "transit"];

export function QuoteBuilder({ proposedBy }: Props) {
  const [step, setStep] = useState(1);
  const [agencyName, setAgencyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [state, setState] = useState("");
  const [vertical, setVertical] = useState<RoiVertical>("rc911");
  const [seatCount, setSeatCount] = useState(8);
  const [callVolume, setCallVolume] = useState(2000);
  const [plan, setPlan] = useState<QuotePlan>("Professional");
  const [selected, setSelected] = useState<string[]>([]);
  const [leadId, setLeadId] = useState("");
  const [notes, setNotes] = useState("");
  const [attachMsg, setAttachMsg] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  const catalog = useMemo(() => filterSalesFeatureCatalog(vertical), [vertical]);

  const freeSelected = selected.filter((id) => getSalesFeatureById(id)?.isFree);
  const paidSelected = selected.filter((id) => !getSalesFeatureById(id)?.isFree);

  function toggle(id: string) {
    const item = getSalesFeatureById(id);
    if (item?.neverFree && selected.includes(id) === false) {
      // Paid neverFree items can still be on a paid order — allow select, never mark free
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function goPlanStep() {
    setPlan(recommendPlan(seatCount, callVolume));
    setStep(2);
  }

  async function attachToLead() {
    if (!leadId.trim()) {
      setAttachMsg("Enter a lead ID to attach this order.");
      return;
    }
    setAttaching(true);
    setAttachMsg(null);
    try {
      const res = await fetch(`/api/rc-admin/leads/${encodeURIComponent(leadId.trim())}/fields`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedFeatureIds: selected,
          freeOfferings: freeSelected,
          agencyName: agencyName || undefined,
          vertical: vertical === "rc911" ? "rc911" : vertical,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAttachMsg(typeof err?.error === "string" ? err.error : "Failed to attach to lead.");
      } else {
        setAttachMsg("Order features saved on lead.");
      }
    } catch {
      setAttachMsg("Network error attaching to lead.");
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStep(n)}
            className={[
              "rounded-full border px-3 py-1",
              step === n
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-white/10 text-slate-600",
            ].join(" ")}
          >
            Step {n}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="grid gap-3 rounded-xl border border-white/5 bg-[#0a1628] p-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">
            Agency
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-400">
            Contact
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-400">
            State
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
              value={state}
              maxLength={2}
              onChange={(e) => setState(e.target.value.toUpperCase())}
            />
          </label>
          <label className="text-xs text-slate-400">
            Vertical
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
              value={vertical}
              onChange={(e) => setVertical(e.target.value as RoiVertical)}
            >
              {VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {verticalLabelForSales(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Seats
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
              value={seatCount}
              onChange={(e) => setSeatCount(Number(e.target.value) || 1)}
            />
          </label>
          <label className="text-xs text-slate-400">
            Monthly call volume
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
              value={callVolume}
              onChange={(e) => setCallVolume(Number(e.target.value) || 0)}
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={goPlanStep}
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 rounded-xl border border-white/5 bg-[#0a1628] p-4">
          <p className="text-sm text-slate-300">
            Recommended plan: <span className="font-semibold text-white">{plan}</span>
            <span className="ml-2 text-xs text-slate-500">(internal guidance — not shown on printed proposal costs)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {(["Essential", "Professional", "Command", "Enterprise"] as QuotePlan[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlan(p)}
                className={[
                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                  plan === p
                    ? "border-sky-500 bg-sky-500/10 text-sky-300"
                    : "border-white/10 text-slate-500",
                ].join(" ")}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(3)}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300"
          >
            Choose features
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Check features for this customer order. Free offerings are labeled. No prices shown.
            Compatible with: <span className="text-slate-200">{verticalLabelForSales(vertical)}</span>
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {catalog.map((item) => {
              const checked = selected.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={[
                    "flex cursor-pointer gap-3 rounded-xl border p-3 transition",
                    checked
                      ? "border-sky-500/40 bg-sky-500/[0.07]"
                      : "border-white/5 bg-[#0a1628] hover:border-white/10",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggle(item.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{item.name}</span>
                      {item.isFree && (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                          Free
                          {item.freeKind === "one_time_service" ? " · one-time" : ""}
                        </span>
                      )}
                      {item.neverFree && (
                        <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                          Paid only
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                      {item.explanation}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {item.compatibleVerticals.map((v) => (
                        <span
                          key={v}
                          className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500"
                        >
                          {verticalLabelForSales(v)}
                        </span>
                      ))}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setStep(4)}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300"
          >
            Preview proposal
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="quote-print rounded-xl border border-white/5 bg-[#0a1628] p-6 print:border-0 print:bg-white print:text-black">
            <h2 className="text-lg font-semibold text-white print:text-black">NexCort iQ Proposal</h2>
            <p className="mt-1 text-sm text-slate-400 print:text-slate-700">
              {agencyName || "Agency"} · {contactName || "Contact"} · {state || "—"} ·{" "}
              {verticalLabelForSales(vertical)}
            </p>
            <p className="mt-3 text-sm text-slate-300 print:text-slate-800">
              Plan: <strong>{plan}</strong>
            </p>
            <p className="mt-1 text-xs text-slate-500 print:text-slate-600">
              Proposed by {proposedBy} · {new Date().toLocaleDateString()}
            </p>
            {freeSelected.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-400 print:text-emerald-700">
                  Free offerings
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300 print:text-slate-800">
                  {freeSelected.map((id) => (
                    <li key={id}>{getSalesFeatureById(id)?.name ?? id}</li>
                  ))}
                </ul>
              </div>
            )}
            {paidSelected.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-sky-400 print:text-sky-800">
                  Included capabilities
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300 print:text-slate-800">
                  {paidSelected.map((id) => (
                    <li key={id}>{getSalesFeatureById(id)?.name ?? id}</li>
                  ))}
                </ul>
              </div>
            )}
            {notes.trim() && (
              <p className="mt-4 text-sm text-slate-400 print:text-slate-700">{notes}</p>
            )}
          </div>
          <label className="block text-xs text-slate-400">
            Proposal notes
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-400">
              Lead ID (attach order)
              <input
                className="mt-1 block w-56 rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                placeholder="leadId"
              />
            </label>
            <button
              type="button"
              disabled={attaching}
              onClick={() => void attachToLead()}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50"
            >
              {attaching ? "Saving…" : "Attach to order"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300"
            >
              Print proposal
            </button>
          </div>
          {attachMsg && <p className="text-xs text-slate-400">{attachMsg}</p>}
        </div>
      )}
    </div>
  );
}
