"use client";

import { useEffect, useState } from "react";
import type { CadFieldMapping, UnifiedCadIncident } from "rapid-cortex-shared";
import { UNIFIED_CAD_INCIDENT_RC_FIELDS } from "rapid-cortex-shared";
import { fetchCadMappings, putCadMappings, testCadConnectorFetch } from "@/lib/cad-connector/cad-connector-api";

export function CadFieldMappingEditor({ connectorId }: { connectorId: string }) {
  const [mappings, setMappings] = useState<CadFieldMapping[]>([]);
  const [samples, setSamples] = useState<UnifiedCadIncident[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCadMappings(connectorId)
      .then(setMappings)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [connectorId]);

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-white">Field mapping</h1>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      <div className="space-y-2">
        {mappings.map((m, i) => (
          <div key={m.mappingId || i} className="grid grid-cols-3 gap-2 text-sm">
            <input
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
              value={m.vendorField}
              onChange={(e) =>
                setMappings((rows) => rows.map((row, idx) => (idx === i ? { ...row, vendorField: e.target.value } : row)))
              }
            />
            <select
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
              value={m.rcField}
              onChange={(e) =>
                setMappings((rows) => rows.map((row, idx) => (idx === i ? { ...row, rcField: e.target.value } : row)))
              }
            >
              {UNIFIED_CAD_INCIDENT_RC_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
              value={m.direction}
              onChange={(e) =>
                setMappings((rows) =>
                  rows.map((row, idx) =>
                    idx === i ? { ...row, direction: e.target.value as CadFieldMapping["direction"] } : row,
                  ),
                )
              }
            >
              <option value="both">both</option>
              <option value="inbound">inbound</option>
              <option value="outbound">outbound</option>
            </select>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1.5 text-sm"
          onClick={() => void putCadMappings(connectorId, mappings).catch((err: unknown) => setError(err instanceof Error ? err.message : "Save failed"))}
        >
          Save mappings
        </button>
        <button
          type="button"
          className="rounded border border-slate-600 px-3 py-1.5 text-sm"
          onClick={() =>
            void testCadConnectorFetch(connectorId)
              .then((r) => setSamples(r.incidents.slice(0, 3)))
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Test failed"))
          }
        >
          Test mapping
        </button>
      </div>
      {samples.length > 0 ? (
        <pre className="mt-4 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-300">
          {JSON.stringify(samples, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
