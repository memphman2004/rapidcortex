"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { verticalLabelForSales } from "rapid-cortex-shared";
import type { TerritoryOwner } from "@/lib/sales/territory-roster";

const QK = ["sales-territories"] as const;

async function fetchTerritories(): Promise<TerritoryOwner[]> {
  const r = await fetch("/api/sales/territories", { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load territories");
  const data = (await r.json()) as { items?: TerritoryOwner[] };
  return data.items ?? [];
}

export function TerritoryRosterPanel() {
  const [q, setQ] = useState("");
  const territoriesQ = useQuery({
    queryKey: QK,
    queryFn: fetchTerritories,
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
    staleTime: 2_000,
  });

  const rows = useMemo(() => {
    const items = territoriesQ.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (o) =>
        o.name.toLowerCase().includes(needle) ||
        o.email.toLowerCase().includes(needle) ||
        o.primaryFocus.toLowerCase().includes(needle) ||
        o.states.some((s) => s.toLowerCase().includes(needle)) ||
        o.assignees.some(
          (a) =>
            a.name.toLowerCase().includes(needle) ||
            a.email.toLowerCase().includes(needle),
        ),
    );
  }, [q, territoriesQ.data]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        See who covers which states. When news or a lead looks relevant, notify that salesperson.
        Assignments are managed in RC Admin → Sales territories.
      </p>
      <input
        className="w-full max-w-md rounded-lg border border-white/10 bg-[#080f1e] px-3 py-2 text-sm text-slate-100"
        placeholder="Search name, email, or state…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {territoriesQ.isError && (
        <p className="text-sm text-rose-400">Unable to load territories. Retrying…</p>
      )}
      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-[#0a1628] text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">Currently assigned</th>
              <th className="px-4 py-3">States</th>
              <th className="px-4 py-3">Primary focus</th>
              <th className="px-4 py-3">Contact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const primaryEmail = o.assignees[0]?.email ?? o.email;
              return (
                <tr key={o.zoneId} className="border-b border-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{o.name}</div>
                    <div className="text-xs text-slate-500">{o.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {o.assignees.length === 0 ? (
                      <span className="text-xs text-slate-500">Unassigned</span>
                    ) : (
                      <ul className="space-y-1">
                        {o.assignees.map((a) => (
                          <li key={a.email}>
                            <div className="text-sm font-medium text-slate-100">{a.name}</div>
                            <div className="text-xs text-slate-500">{a.email}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">{o.states.join(", ")}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <div>{o.primaryFocus}</div>
                    <div className="mt-1 text-[11px] text-slate-600">
                      {o.verticals.map((v) => verticalLabelForSales(v)).join(", ")}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      className="text-xs font-semibold text-sky-400 hover:underline"
                      href={`mailto:${primaryEmail}?subject=Sales%20lead%20/%20news%20handoff`}
                    >
                      Email
                    </a>
                    <button
                      type="button"
                      className="ml-3 text-xs text-slate-500 hover:text-slate-300"
                      onClick={() => void navigator.clipboard.writeText(primaryEmail)}
                    >
                      Copy
                    </button>
                  </td>
                </tr>
              );
            })}
            {!territoriesQ.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  No zones match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
