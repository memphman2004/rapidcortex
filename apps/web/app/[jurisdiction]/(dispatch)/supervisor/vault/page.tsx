"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/components/auth/session-context";
import { isNexiqVaultEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorVaultSearchPage() {
  const { user } = useSession();
  const [addr, setAddr] = useState("");
  const [q, setQ] = useState("");
  const enabled = isNexiqVaultEnabled();

  const search = useQuery({
    queryKey: ["vault-search", addr, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (addr) params.set("addr", addr);
      if (q) params.set("q", q);
      const res = await fetch(`/api/vault/search?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("search failed");
      return res.json() as Promise<{ items: Array<Record<string, string>> }>;
    },
    enabled: enabled && Boolean(addr || q),
  });

  if (!enabled) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        NexiQ Vault is not enabled for this deployment.
      </div>
    );
  }

  if (!isSupervisorOrStaffRole(user?.role) && user?.role !== "agencyadmin" && user?.role !== "analyst") {
    return <SupervisorAccessRestricted />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8 text-slate-100">
      <header>
        <h1 className="text-2xl font-semibold">NexiQ Vault</h1>
        <p className="mt-1 text-sm text-slate-400">
          Search historical CAD / call records. No JMS or criminal-history data.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <input
          className="min-w-[200px] flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="Address"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
        />
        <input
          className="min-w-[200px] flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="Narrative contains…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {search.isFetching ? <p className="text-sm text-slate-400">Searching…</p> : null}
      {search.data ? (
        <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800 text-sm">
          {search.data.items.length === 0 ? (
            <li className="px-4 py-6 text-slate-500">No matches.</li>
          ) : (
            search.data.items.map((it, i) => (
              <li key={`${it.sk ?? i}`} className="px-4 py-3">
                <div className="font-medium">
                  {String(it.callDate ?? "")} · {String(it.callType ?? "—")}
                </div>
                <div className="text-slate-400">{String(it.address ?? "")}</div>
                {it.narrative ? (
                  <div className="mt-1 line-clamp-2 text-slate-500">{String(it.narrative)}</div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
