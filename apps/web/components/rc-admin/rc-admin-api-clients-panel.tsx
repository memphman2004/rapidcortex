"use client";

import { useEffect, useState } from "react";
import type { UserContext } from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { AccessDenied } from "@/components/dashboards/access-denied";
import { fetchRcAdminApiClients } from "@/lib/api";

export function RcAdminApiClientsPanel({ user }: { user: UserContext }) {
  const [agencyId, setAgencyId] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<unknown[] | null>(null);

  async function reload() {
    const items = await fetchRcAdminApiClients({
      agencyId: agencyId.trim() || undefined,
      status: status.trim() || undefined,
    });
    setRows(items);
  }

  useEffect(() => {
    if (!isRcsuperadmin(user)) return;
    void reload().catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial sweep only (filters use button)
  }, [user]);

  if (!isRcsuperadmin(user)) {
    return <AccessDenied user={user} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-xl font-semibold text-white">Tenant API integrations</h1>
        <p className="mt-1 max-w-prose text-sm text-slate-400">
          Cross-agency oversight of issuance. Customer secrets are hashed at rest—only hashed material is persisted.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Filter agency
          <input
            className="rounded border border-slate-700 bg-neutral-950 px-2 py-1 text-sm"
            placeholder="agency id"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Filter status
          <input
            className="rounded border border-slate-700 bg-neutral-950 px-2 py-1 text-sm"
            placeholder="active | disabled ..."
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Apply filters
        </button>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-900 bg-neutral-950">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="px-4 py-2">Agency</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Env</th>
              <th className="px-4 py-2">Last used</th>
              <th className="px-4 py-2">Failures</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const row = r as Record<string, unknown>;
              const id = String(row.clientId ?? "");
              return (
                <tr key={id} className="border-t border-neutral-900">
                  <td className="px-4 py-2 font-mono text-xs">{String(row.agencyId ?? "")}</td>
                  <td className="px-4 py-2 font-mono text-xs">{id}</td>
                  <td className="px-4 py-2 capitalize">{String(row.status ?? "")}</td>
                  <td className="px-4 py-2">{String(row.environment ?? "")}</td>
                  <td className="px-4 py-2">{String(row.lastUsedAt ?? "") || "—"}</td>
                  <td className="px-4 py-2 text-neutral-500">—</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
