"use client";

import { useEffect, useState } from "react";
import type { ActivityReport } from "rapid-cortex-shared";

type Props = {
  contractorEmail?: string;
  contractorName?: string;
};

function mondayOf(d = new Date()): string {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x.toISOString().slice(0, 10);
}

export function ActivityLog({ contractorEmail, contractorName }: Props) {
  const [weekOf, setWeekOf] = useState(mondayOf());
  const [history, setHistory] = useState<ActivityReport[]>([]);
  const [form, setForm] = useState({
    callsMade: 0,
    emailsSent: 0,
    meetingsBooked: 0,
    demosDelivered: 0,
    newLeadsAdded: 0,
    stageAdvances: 0,
    blockers: "",
    highlights: "",
  });
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/sales/activity", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: ActivityReport[] };
    setHistory(data.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submit() {
    setMsg(null);
    const res = await fetch("/api/sales/activity", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekOf,
        contractorName: contractorName ?? contractorEmail ?? "Contractor",
        ...form,
      }),
    });
    if (!res.ok) {
      setMsg("Submit failed.");
      return;
    }
    setMsg("Saved.");
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
        <label className="text-xs text-slate-400">
          Week of (Monday)
          <input
            type="date"
            className="mt-1 block rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
            value={weekOf}
            onChange={(e) => setWeekOf(e.target.value)}
          />
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(
            [
              ["callsMade", "Calls"],
              ["emailsSent", "Emails"],
              ["meetingsBooked", "Meetings"],
              ["demosDelivered", "Demos"],
              ["newLeadsAdded", "New leads"],
              ["stageAdvances", "Stage advances"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-xs text-slate-400">
              {label}
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
                value={form[key]}
                onChange={(e) =>
                  setForm((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))
                }
              />
            </label>
          ))}
        </div>
        <label className="mt-3 block text-xs text-slate-400">
          Highlights
          <textarea
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
            rows={2}
            value={form.highlights}
            onChange={(e) => setForm((p) => ({ ...p, highlights: e.target.value }))}
          />
        </label>
        <label className="mt-3 block text-xs text-slate-400">
          Blockers
          <textarea
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
            rows={2}
            value={form.blockers}
            onChange={(e) => setForm((p) => ({ ...p, blockers: e.target.value }))}
          />
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          className="mt-3 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300"
        >
          Submit week
        </button>
        {msg && <p className="mt-2 text-xs text-slate-400">{msg}</p>}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase text-slate-500">History</h3>
        {history.slice(0, 12).map((h) => (
          <div
            key={`${h.contractorEmail}-${h.weekOf}-${h.submittedAt}`}
            className="rounded-lg border border-white/5 bg-[#0a1628] px-3 py-2 text-xs text-slate-400"
          >
            <span className="font-semibold text-slate-200">{h.weekOf}</span> — {h.callsMade} calls,{" "}
            {h.emailsSent} emails, {h.demosDelivered} demos
          </div>
        ))}
      </div>
    </div>
  );
}
