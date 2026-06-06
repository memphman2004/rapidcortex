"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { GlobalAuditTable } from "@/components/platform/global-audit-table";
import { fetchAgencies, fetchPlatformAuditEvents } from "@/lib/api";

export default function PlatformAuditPage() {
  const [agencyId, setAgencyId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const agenciesQ = useQuery({ queryKey: ["agencies"], queryFn: fetchAgencies });
  const auditQ = useQuery({
    queryKey: ["platform-audit", agencyId, type, from, to],
    queryFn: () =>
      fetchPlatformAuditEvents({
        limit: 150,
        perAgencyCap: 40,
        agencyId: agencyId.trim() || undefined,
        type: type.trim() || undefined,
        from: from.trim() || undefined,
        to: to.trim() || undefined,
      }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Global audit log</h1>
        <p className="text-sm text-slate-400">
          Merges per-agency audit storage (capped per tenant for cost). Use type prefix to narrow — e.g.{" "}
          <code className="font-mono text-slate-500">admin</code> or <code className="font-mono">agency</code>.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-500">
          Agency
          <select
            className="mt-0.5 w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-sm"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
          >
            <option value="">All (merged)</option>
            {(agenciesQ.data ?? []).map((a) => (
              <option key={a.agencyId} value={a.agencyId}>
                {a.name} ({a.agencyId})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Type prefix
          <input
            className="mt-0.5 w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g. admin.user"
          />
        </label>
        <label className="text-xs text-slate-500">
          From (ISO)
          <input
            className="mt-0.5 w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="2026-01-01T00:00:00Z"
          />
        </label>
        <label className="text-xs text-slate-500">
          To (ISO)
          <input
            className="mt-0.5 w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="2026-12-31T23:59:59Z"
          />
        </label>
      </div>

      {auditQ.isLoading ? (
        <p className="text-sm text-slate-500">Loading events…</p>
      ) : auditQ.isError ? (
        <p className="text-sm text-rose-300">Failed to load audit data.</p>
      ) : (
        <GlobalAuditTable items={auditQ.data ?? []} />
      )}
    </div>
  );
}
