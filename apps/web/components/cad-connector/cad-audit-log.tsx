"use client";

import { useEffect, useState } from "react";
import { fetchCadConnectorAudit } from "@/lib/cad-connector/cad-connector-api";

export function CadAuditLog() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCadConnectorAudit()
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Load failed"));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-white">CAD connector audit</h1>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      <div className="space-y-2">
        {items.map((row, i) => (
          <pre key={String(row.eventId ?? i)} className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-300">
            {JSON.stringify(row, null, 2)}
          </pre>
        ))}
        {items.length === 0 ? <p className="text-sm text-slate-500">No CAD connector audit events.</p> : null}
      </div>
    </div>
  );
}
