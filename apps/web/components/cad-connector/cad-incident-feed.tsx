"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UnifiedCadIncident, UserContext } from "rapid-cortex-shared";
import { canSubmitWriteBack } from "@/lib/cad-connector/cad-authz";
import { fetchCadIncidents, submitCadWriteBack } from "@/lib/cad-connector/cad-connector-api";

function priorityClass(p: number): string {
  if (p === 1) return "text-red-400";
  if (p === 2) return "text-amber-400";
  if (p === 3) return "text-yellow-300";
  return "text-slate-400";
}

export function CadIncidentFeed({
  user,
  jurisdiction,
}: {
  user: UserContext;
  jurisdiction: string;
}) {
  const [items, setItems] = useState<UnifiedCadIncident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ department: "", status: "", connectorId: "" });
  const [narrative, setNarrative] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sp = new URLSearchParams();
    sp.set("activeOnly", "1");
    if (filter.department) sp.set("department", filter.department);
    if (filter.status) sp.set("status", filter.status);
    if (filter.connectorId) sp.set("connectorId", filter.connectorId);
    const q = `?${sp.toString()}`;
    setError(null);
    try {
      setItems(await fetchCadIncidents(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    }
  }, [filter]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(id);
  }, [load]);

  const canSubmit = canSubmitWriteBack(user, user.agencyId);
  const connectors = useMemo(
    () => Array.from(new Set(items.map((i) => i.connectorId))),
    [items],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-white">Unified incident feed</h1>
        <button type="button" onClick={() => void load()} className="rounded-md bg-sky-700 px-3 py-1.5 text-sm text-white">
          Refresh
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <select
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
          value={filter.department}
          onChange={(e) => setFilter((f) => ({ ...f, department: e.target.value }))}
        >
          <option value="">All departments</option>
          <option value="law_enforcement">Law enforcement</option>
          <option value="fire">Fire</option>
          <option value="ems">EMS</option>
          <option value="combined_fire_ems">Fire/EMS</option>
        </select>
        <select
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">All statuses</option>
          <option value="dispatched">Dispatched</option>
          <option value="en_route">En route</option>
          <option value="on_scene">On scene</option>
        </select>
        <select
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
          value={filter.connectorId}
          onChange={(e) => setFilter((f) => ({ ...f, connectorId: e.target.value }))}
        >
          <option value="">All connectors</option>
          {connectors.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      <div className="space-y-2">
        {items.map((row) => (
          <div key={row.unifiedId} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className={`font-semibold ${priorityClass(row.priority)}`}>
                  P{row.priority} · {row.incidentType}
                  {row.isDuplicate ? (
                    <span className="ml-2 rounded bg-sky-900 px-2 py-0.5 text-xs text-sky-200">CROSS-CAD DUPLICATE</span>
                  ) : null}
                </p>
                <p className="text-sm text-slate-300">{row.address ?? "No address"}</p>
                <p className="text-xs text-slate-500">
                  {row.department} · CAD# {row.cadIncidentNumber ?? row.vendorIncidentId} · {row.status}
                </p>
              </div>
              <Link className="text-sm text-sky-400 hover:underline" href={`/${jurisdiction}/cad/incidents/${row.unifiedId}`}>
                Open
              </Link>
            </div>
            {canSubmit ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-white"
                  onClick={() => setTargetId(row.unifiedId)}
                >
                  Add narrative
                </button>
              </div>
            ) : null}
            {targetId === row.unifiedId ? (
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder="Narrative for write-back"
                />
                <button
                  type="button"
                  className="rounded bg-sky-700 px-2 py-1 text-xs"
                  onClick={() => {
                    void submitCadWriteBack({
                      unifiedId: row.unifiedId,
                      payload: { action: "add_narrative", fields: {}, narrative },
                    }).then(() => {
                      setNarrative("");
                      setTargetId(null);
                    });
                  }}
                >
                  Submit
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {items.length === 0 ? <p className="text-sm text-slate-500">No unified CAD incidents yet.</p> : null}
      </div>
    </div>
  );
}
