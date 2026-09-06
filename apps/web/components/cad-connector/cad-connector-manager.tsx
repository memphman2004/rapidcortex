"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CadConnectorConfig, CadVendorId, UserContext } from "rapid-cortex-shared";
import { canDeleteCadConnectors } from "@/lib/cad-connector/cad-authz";
import {
  createCadConnector,
  deleteCadConnector,
  fetchCadConnectors,
  setCadConnectorEnabled,
  testCadConnectorFetch,
  testCadConnectorHealth,
} from "@/lib/cad-connector/cad-connector-api";

const VENDORS: Array<{ id: CadVendorId; label: string }> = [
  { id: "motorola_premierone", label: "Motorola PremierOne" },
  { id: "tyler_new_world", label: "Tyler New World" },
  { id: "hexagon_intergraph", label: "Hexagon I/CAD" },
  { id: "central_square", label: "CentralSquare" },
  { id: "spillman", label: "Spillman Flex" },
  { id: "generic_rest", label: "Generic REST" },
];

type Draft = {
  vendorId: CadVendorId;
  displayName: string;
  department: CadConnectorConfig["department"];
  connectionMode: CadConnectorConfig["connectionMode"];
  pollingIntervalSeconds: number;
  baseUrl: string;
  authType: CadConnectorConfig["credentials"]["authType"];
  apiKey: string;
};

const emptyDraft: Draft = {
  vendorId: "motorola_premierone",
  displayName: "",
  department: "law_enforcement",
  connectionMode: "polling",
  pollingIntervalSeconds: 60,
  baseUrl: "https://cad.example.local",
  authType: "api_key",
  apiKey: "",
};

export function CadConnectorManager({
  user,
  jurisdiction,
}: {
  user: UserContext;
  jurisdiction: string;
}) {
  const [items, setItems] = useState<CadConnectorConfig[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const canDelete = canDeleteCadConnectors(user, user.agencyId);

  async function reload() {
    setItems(await fetchCadConnectors());
  }

  useEffect(() => {
    void reload().catch((err: unknown) => setError(err instanceof Error ? err.message : "Load failed"));
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">CAD connectors</h1>
        <button
          type="button"
          className="rounded-md bg-sky-700 px-3 py-1.5 text-sm"
          onClick={() => {
            setDraft(emptyDraft);
            setStep(1);
            setOpen(true);
          }}
        >
          Add connector
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">Name</th>
            <th>Vendor</th>
            <th>Department</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Last sync</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.connectorId} className="border-t border-slate-800">
              <td className="py-2">{c.displayName}</td>
              <td>{c.vendorId}</td>
              <td>{c.department}</td>
              <td>{c.connectionMode}</td>
              <td>{c.enabled ? "enabled" : "disabled"} · {c.lastHealthCheck?.status ?? "unknown"}</td>
              <td>{c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "never"}</td>
              <td className="space-x-2 text-right">
                <Link className="text-sky-400" href={`/${jurisdiction}/cad/connectors/${c.connectorId}/mappings`}>
                  Mappings
                </Link>
                <button type="button" className="text-sky-400" onClick={() => void setCadConnectorEnabled(c.connectorId, !c.enabled).then(reload)}>
                  {c.enabled ? "Disable" : "Enable"}
                </button>
                <button type="button" className="text-sky-400" onClick={() => void testCadConnectorHealth(c.connectorId).then(reload)}>
                  Health
                </button>
                {canDelete ? (
                  <button type="button" className="text-red-400" onClick={() => void deleteCadConnector(c.connectorId).then(reload)}>
                    Delete
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {open ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-slate-950 p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold">Configure connector · step {step} of 4</h2>
            {step === 1 ? (
              <div className="grid grid-cols-2 gap-2">
                {VENDORS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`rounded border p-3 text-left text-sm ${draft.vendorId === v.id ? "border-sky-500 bg-sky-950" : "border-slate-700"}`}
                    onClick={() => setDraft((d) => ({ ...d, vendorId: v.id }))}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            ) : null}
            {step === 2 ? (
              <div className="space-y-3 text-sm">
                <input className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1" placeholder="Display name" value={draft.displayName} onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))} />
                <select
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                  value={draft.department}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, department: e.target.value as CadConnectorConfig["department"] }))
                  }
                >
                  <option value="law_enforcement">Law enforcement</option>
                  <option value="fire">Fire</option>
                  <option value="ems">EMS</option>
                  <option value="combined_fire_ems">Combined fire/EMS</option>
                  <option value="emergency_management">Emergency management</option>
                  <option value="combined_all">Combined all</option>
                </select>
                <input className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1" placeholder="https://cad.agency.local" value={draft.baseUrl} onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))} />
                <input className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1" type="password" placeholder="API key (write-only)" value={draft.apiKey} onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))} />
                <input className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1" type="number" min={30} max={300} value={draft.pollingIntervalSeconds} onChange={(e) => setDraft((d) => ({ ...d, pollingIntervalSeconds: Number(e.target.value) }))} />
              </div>
            ) : null}
            {step === 3 ? (
              <p className="text-sm text-slate-400">
                After save, use Health and Test fetch on the connector row. Credentials are write-only and never shown again.
              </p>
            ) : null}
            {step === 4 ? (
              <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-300">{JSON.stringify({ ...draft, apiKey: draft.apiKey ? "••••" : "" }, null, 2)}</pre>
            ) : null}
            <div className="mt-6 flex justify-between">
              <button type="button" className="text-sm text-slate-400" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <div className="space-x-2">
                {step > 1 ? (
                  <button type="button" className="rounded border border-slate-700 px-3 py-1 text-sm" onClick={() => setStep((s) => s - 1)}>
                    Back
                  </button>
                ) : null}
                {step < 4 ? (
                  <button type="button" className="rounded bg-sky-700 px-3 py-1 text-sm" onClick={() => setStep((s) => s + 1)}>
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded bg-sky-700 px-3 py-1 text-sm"
                    onClick={() => {
                      void createCadConnector({
                        vendorId: draft.vendorId,
                        displayName: draft.displayName || draft.vendorId,
                        department: draft.department,
                        connectionMode: draft.connectionMode,
                        pollingIntervalSeconds: draft.pollingIntervalSeconds,
                        baseUrl: draft.baseUrl,
                        authType: draft.authType,
                        apiKey: draft.apiKey || undefined,
                        enabled: false,
                      })
                        .then(() => {
                          setOpen(false);
                          return reload();
                        })
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Save failed"));
                    }}
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              className="mt-4 text-xs text-slate-500"
              onClick={() => {
                if (!items[0]) return;
                void testCadConnectorFetch(items[0].connectorId);
              }}
            >
              Test fetch (first connector)
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
