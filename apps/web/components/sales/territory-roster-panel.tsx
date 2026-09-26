"use client";

import { useMemo, useState } from "react";
import { TERRITORY_ROSTER } from "@/lib/sales/territory-roster";
import { verticalLabelForSales } from "rapid-cortex-shared";

export function TerritoryRosterPanel() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [...TERRITORY_ROSTER];
    return TERRITORY_ROSTER.filter(
      (o) =>
        o.name.toLowerCase().includes(needle) ||
        o.email.toLowerCase().includes(needle) ||
        o.states.some((s) => s.toLowerCase().includes(needle)),
    );
  }, [q]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        See who covers which states. When news or a lead looks relevant, notify that salesperson.
      </p>
      <input
        className="w-full max-w-md rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
        placeholder="Search name, email, or state…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-[#0a1628] text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">States</th>
              <th className="px-4 py-3">Verticals</th>
              <th className="px-4 py-3">Contact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.email} className="border-b border-white/[0.03]">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{o.name}</div>
                  <div className="text-xs text-slate-500">{o.email}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">{o.states.join(", ")}</td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {o.verticals.map((v) => verticalLabelForSales(v)).join(", ")}
                </td>
                <td className="px-4 py-3">
                  <a
                    className="text-xs font-semibold text-sky-400 hover:underline"
                    href={`mailto:${o.email}?subject=Sales%20lead%20/%20news%20handoff`}
                  >
                    Email
                  </a>
                  <button
                    type="button"
                    className="ml-3 text-xs text-slate-500 hover:text-slate-300"
                    onClick={() => void navigator.clipboard.writeText(o.email)}
                  >
                    Copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
