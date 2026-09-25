"use client";

import { useEffect, useState } from "react";
import type { RfpRecord, RfpStage, RoiVertical } from "rapid-cortex-shared";
import { verticalLabelForSales } from "rapid-cortex-shared";

const STAGES: RfpStage[] = [
  "IDENTIFIED",
  "QUALIFYING",
  "CAPTURE",
  "NO_BID",
  "PROPOSAL",
  "SUBMITTED",
  "AWARD",
  "LOST",
];

type Props = { defaultAssignee?: string };

export function RfpTracker({ defaultAssignee }: Props) {
  const [items, setItems] = useState<RfpRecord[]>([]);
  const [form, setForm] = useState({
    agencyName: "",
    rfpNumber: "",
    title: "",
    vertical: "rc911" as RoiVertical,
    state: "",
    deadlineDate: "",
    estimatedValueDollars: 0,
    assignedTo: defaultAssignee ?? "",
    notes: "",
  });

  async function refresh() {
    const res = await fetch("/api/sales/rfp", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: RfpRecord[] };
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function create() {
    const res = await fetch("/api/sales/rfp", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({
        agencyName: "",
        rfpNumber: "",
        title: "",
        vertical: "rc911",
        state: "",
        deadlineDate: "",
        estimatedValueDollars: 0,
        assignedTo: defaultAssignee ?? "",
        notes: "",
      });
      await refresh();
    }
  }

  async function setStage(rfpId: string, stage: RfpStage) {
    await fetch(`/api/sales/rfp/${encodeURIComponent(rfpId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    await refresh();
  }

  function deadlineClass(deadlineDate: string): string {
    if (!deadlineDate) return "text-slate-500";
    const days = Math.ceil((Date.parse(deadlineDate) - Date.now()) / 86400000);
    if (Number.isNaN(days)) return "text-slate-500";
    if (days < 0) return "text-red-400";
    if (days <= 14) return "text-amber-300";
    return "text-slate-400";
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-xl border border-white/5 bg-[#0a1628] p-4 md:grid-cols-3">
        {(
          [
            ["agencyName", "Agency"],
            ["title", "Title"],
            ["rfpNumber", "RFP #"],
            ["state", "State"],
            ["deadlineDate", "Deadline (ISO)"],
            ["assignedTo", "Assigned to"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-xs text-slate-400">
            {label}
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            />
          </label>
        ))}
        <label className="text-xs text-slate-400">
          Vertical
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
            value={form.vertical}
            onChange={(e) =>
              setForm((p) => ({ ...p, vertical: e.target.value as RoiVertical }))
            }
          >
            {(["rc911", "campus", "venue", "hospital", "transit"] as RoiVertical[]).map((v) => (
              <option key={v} value={v}>
                {verticalLabelForSales(v)}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-3">
          <button
            type="button"
            onClick={() => void create()}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300"
          >
            Add RFP
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {STAGES.filter((s) => s !== "NO_BID" && s !== "LOST").map((stage) => (
          <div key={stage} className="rounded-xl border border-white/5 bg-[#0a1628] p-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{stage}</h3>
            <div className="mt-2 space-y-2">
              {items
                .filter((i) => i.stage === stage)
                .map((rfp) => (
                  <div key={rfp.rfpId} className="rounded-lg border border-white/5 bg-[#080f1e] p-2">
                    <div className="text-xs font-semibold text-white">{rfp.title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{rfp.agencyName}</div>
                    <div className={`mt-1 text-[11px] ${deadlineClass(rfp.deadlineDate)}`}>
                      {rfp.deadlineDate || "No deadline"}
                    </div>
                    <select
                      className="mt-2 w-full rounded border border-white/10 bg-transparent px-1 py-1 text-[10px] text-slate-400"
                      value={rfp.stage}
                      onChange={(e) => void setStage(rfp.rfpId, e.target.value as RfpStage)}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
