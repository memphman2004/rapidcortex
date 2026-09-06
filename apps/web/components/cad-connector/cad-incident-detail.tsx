"use client";

import { useEffect, useState } from "react";
import type { UnifiedCadIncident, UserContext } from "rapid-cortex-shared";
import { canSubmitWriteBack } from "@/lib/cad-connector/cad-authz";
import { fetchCadDuplicates, fetchCadIncident, submitCadWriteBack } from "@/lib/cad-connector/cad-connector-api";

export function CadIncidentDetail({
  user,
  unifiedId,
}: {
  user: UserContext;
  unifiedId: string;
}) {
  const [incident, setIncident] = useState<UnifiedCadIncident | null>(null);
  const [dups, setDups] = useState<UnifiedCadIncident[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetchCadIncident(unifiedId), fetchCadDuplicates(unifiedId)])
      .then(([inc, dup]) => {
        setIncident(inc);
        setDups(dup);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [unifiedId]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!incident) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div>
      <h1 className="text-lg font-semibold text-white">
        {incident.incidentType} · {incident.cadIncidentNumber ?? incident.vendorIncidentId}
      </h1>
      <p className="mt-1 text-sm text-slate-400">{incident.address}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-slate-500">Status</dt>
        <dd>{incident.status}</dd>
        <dt className="text-slate-500">Department</dt>
        <dd>{incident.department}</dd>
        <dt className="text-slate-500">Priority</dt>
        <dd>P{incident.priority}</dd>
        <dt className="text-slate-500">Connector</dt>
        <dd>{incident.connectorId}</dd>
      </dl>
      {incident.isDuplicate ? (
        <p className="mt-3 text-sm text-sky-300">Cross-CAD duplicate of {incident.canonicalUnifiedId}</p>
      ) : null}
      {dups.length > 0 ? (
        <div className="mt-4">
          <h2 className="text-sm font-medium text-slate-300">Duplicates</h2>
          <ul className="mt-1 text-xs text-slate-500">
            {dups.map((d) => (
              <li key={d.unifiedId}>
                {d.unifiedId} · {d.connectorId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {canSubmitWriteBack(user, user.agencyId) ? (
        <button
          type="button"
          className="mt-4 rounded bg-sky-700 px-3 py-1.5 text-sm"
          onClick={() =>
            void submitCadWriteBack({
              unifiedId: incident.unifiedId,
              payload: { action: "add_narrative", fields: {}, narrative: "Dispatcher note from unified CAD feed" },
            })
          }
        >
          Submit narrative write-back
        </button>
      ) : null}
    </div>
  );
}
