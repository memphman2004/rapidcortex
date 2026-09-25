"use client";

import { useEffect, useState } from "react";
import type { AccountClaim, RoiVertical } from "rapid-cortex-shared";
import { verticalLabelForSales } from "rapid-cortex-shared";

export function AccountClaims() {
  const [items, setItems] = useState<AccountClaim[]>([]);
  const [me, setMe] = useState<string>("");
  const [form, setForm] = useState({
    agencySlug: "",
    agencyName: "",
    vertical: "rc911" as RoiVertical,
    state: "",
    notes: "",
  });

  async function refresh() {
    const res = await fetch("/api/sales/claims", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: AccountClaim[]; me?: string };
    setItems(data.items ?? []);
    if (data.me) setMe(data.me);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function register() {
    await fetch("/api/sales/claims", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ agencySlug: "", agencyName: "", vertical: "rc911", state: "", notes: "" });
    await refresh();
  }

  async function release(agencySlug: string) {
    await fetch(`/api/sales/claims?agencySlug=${encodeURIComponent(agencySlug)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Account claims are advisory — soft registration to avoid contractor conflicts. Never blocking.
      </p>
      <div className="grid gap-2 rounded-xl border border-white/5 bg-[#0a1628] p-4 md:grid-cols-2">
        {(
          [
            ["agencySlug", "Agency slug"],
            ["agencyName", "Agency name"],
            ["state", "State"],
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
        <div className="md:col-span-2">
          <button
            type="button"
            onClick={() => void register()}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-300"
          >
            Register claim
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-[#0a1628] text-[11px] uppercase text-slate-500">
              <th className="px-4 py-2">Agency</th>
              <th className="px-4 py-2">State</th>
              <th className="px-4 py-2">Claimed by</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const mine = me && c.claimedByEmail.toLowerCase() === me.toLowerCase();
              return (
                <tr
                  key={`${c.agencySlug}-${c.claimedByEmail}`}
                  className={
                    mine
                      ? "border-b border-sky-500/20 bg-sky-500/[0.05]"
                      : "border-b border-white/[0.03]"
                  }
                >
                  <td className="px-4 py-2 text-slate-200">{c.agencyName}</td>
                  <td className="px-4 py-2 text-slate-400">{c.state}</td>
                  <td className="px-4 py-2 text-xs text-slate-400">
                    {c.claimedByName} ({c.claimedByEmail})
                  </td>
                  <td className="px-4 py-2 text-right">
                    {mine && (
                      <button
                        type="button"
                        className="text-[11px] text-red-300"
                        onClick={() => void release(c.agencySlug)}
                      >
                        Release
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
