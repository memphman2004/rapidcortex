"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { listProtocolPacks, parseCadNatureCodeMappings, type CadNatureCodeMapping } from "rapid-cortex-shared";
import { patchCadIntegration, type CadAdminIntegration } from "@/lib/api";
import { INCIDENT_TYPES } from "@/lib/dispatcher/incident-protocols";

const RC_TYPE_PROTOCOL: Record<string, string> = {
  cardiac: "default.cpr_cardiac_v1",
  structure_fire: "default.fire_evac_v1",
  domestic: "default.domestic_silent_v1",
  welfare_check: "default.welfare_check_v1",
  overdose: "default.unconscious_v1",
  medical_general: "default.unknown_stress_v1",
};

const RC_TYPE_CATEGORY: Record<string, CadNatureCodeMapping["rcIncidentCategory"]> = {
  assault: "police",
  shots_fired: "police",
  burglary: "police",
  disturbance: "police",
  mvc: "police",
  domestic: "domestic_disturbance",
  structure_fire: "fire",
  cardiac: "medical",
  overdose: "medical",
  medical_general: "medical",
  welfare_check: "welfare_check",
  other: "unknown",
};

const CATEGORIES: NonNullable<CadNatureCodeMapping["rcIncidentCategory"]>[] = [
  "medical",
  "fire",
  "police",
  "welfare_check",
  "domestic_disturbance",
  "unknown",
];

type MappingRow = CadNatureCodeMapping & { mappingId: string };

function withMappingIds(rows: CadNatureCodeMapping[]): MappingRow[] {
  return rows.map((r) => ({ ...r, mappingId: r.mappingId || crypto.randomUUID() }));
}

function emptyRow(): MappingRow {
  return {
    mappingId: crypto.randomUUID(),
    cadNatureCode: "",
    cadNatureAliases: [],
    supervisorAlert: false,
    sopOnIngest: true,
    enabled: true,
  };
}

type Props = {
  integration: CadAdminIntegration;
  canEdit: boolean;
};

export function CadNatureCodeMappingEditor({ integration, canEdit }: Props) {
  const qc = useQueryClient();
  const packs = useMemo(() => listProtocolPacks(), []);
  const [rows, setRows] = useState<MappingRow[]>(() =>
    withMappingIds(parseCadNatureCodeMappings(integration.config)),
  );
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async (natureCodeMappings: CadNatureCodeMapping[]) => {
      return patchCadIntegration(integration.id, { config: { natureCodeMappings } });
    },
    onSuccess: async (res) => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ["cad-integrations"] });
      setRows(withMappingIds(parseCadNatureCodeMappings(res.integration?.config)));
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateRow = (id: string, patch: Partial<CadNatureCodeMapping>) => {
    setRows((prev) => prev.map((r) => (r.mappingId === id ? { ...r, ...patch } : r)));
  };

  const applyRcType = (id: string, rcIncidentTypeId: string) => {
    const def = INCIDENT_TYPES.find((t) => t.id === rcIncidentTypeId);
    updateRow(id, {
      rcIncidentTypeId: rcIncidentTypeId || undefined,
      rcIncidentTypeLabel: def?.label,
      rcIncidentCategory: RC_TYPE_CATEGORY[rcIncidentTypeId],
      protocolPackId: RC_TYPE_PROTOCOL[rcIncidentTypeId] ?? undefined,
      supervisorAlert: def?.supervisorAlert,
      defaultPriority: def?.defaultPriority,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">CAD nature-code mapping</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Map your CAD nature / problem codes to Rapid Cortex incident types and SOP packs. CAD remains the
          system of record — Rapid Cortex uses this table for intelligence only (SOP overlay, category, supervisor
          alert). Write-back is not enabled.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-3 py-4 text-xs text-slate-500">
          No mappings yet. Add your agency CAD codes (e.g. <span className="font-mono text-slate-300">DV-IP</span>
          , <span className="font-mono text-slate-300">10-16</span>) so ingest can apply the right protocol.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.mappingId} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={row.enabled !== false}
                    disabled={!canEdit}
                    onChange={(e) => updateRow(row.mappingId, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                {canEdit ? (
                  <button
                    type="button"
                    className="text-[11px] text-rose-300 hover:text-rose-200"
                    onClick={() => setRows((prev) => prev.filter((r) => r.mappingId !== row.mappingId))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-[11px] text-slate-400">
                  CAD nature code
                  <input
                    value={row.cadNatureCode}
                    disabled={!canEdit}
                    onChange={(e) => updateRow(row.mappingId, { cadNatureCode: e.target.value })}
                    placeholder="DV-IP"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100 disabled:opacity-60"
                  />
                </label>
                <label className="block text-[11px] text-slate-400">
                  Aliases (comma-separated)
                  <input
                    value={(row.cadNatureAliases ?? []).join(", ")}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateRow(row.mappingId, {
                        cadNatureAliases: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="10-16, DOM"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100 disabled:opacity-60"
                  />
                </label>
                <label className="block text-[11px] text-slate-400">
                  Rapid Cortex type
                  <select
                    value={row.rcIncidentTypeId ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => applyRcType(row.mappingId, e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 disabled:opacity-60"
                  >
                    <option value="">— Unmapped (keep CAD type) —</option>
                    {INCIDENT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({t.cadNatureCode})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] text-slate-400">
                  SOP protocol pack
                  <select
                    value={row.protocolPackId ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => updateRow(row.mappingId, { protocolPackId: e.target.value || undefined })}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 disabled:opacity-60"
                  >
                    <option value="">— None (transcript detection only) —</option>
                    {packs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] text-slate-400">
                  RC category
                  <select
                    value={row.rcIncidentCategory ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateRow(row.mappingId, {
                        rcIncidentCategory: (e.target.value || undefined) as CadNatureCodeMapping["rcIncidentCategory"],
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 disabled:opacity-60"
                  >
                    <option value="">— Leave unknown —</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-5 flex items-center gap-2 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={row.sopOnIngest !== false}
                    disabled={!canEdit}
                    onChange={(e) => updateRow(row.mappingId, { sopOnIngest: e.target.checked })}
                  />
                  Apply SOP on CAD ingest
                </label>
                <label className="flex items-center gap-2 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={Boolean(row.supervisorAlert)}
                    disabled={!canEdit}
                    onChange={(e) => updateRow(row.mappingId, { supervisorAlert: e.target.checked })}
                  />
                  Supervisor alert on ingest
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Add mapping
            </button>
            <button
              type="button"
              disabled={saveMut.isPending}
              onClick={() => {
                const incomplete = rows.filter((r) => r.enabled !== false && !r.cadNatureCode.trim());
                if (incomplete.length) {
                  setError("Every enabled mapping needs a CAD nature code.");
                  return;
                }
                void saveMut.mutateAsync(rows);
              }}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saveMut.isPending ? "Saving…" : "Save mappings"}
            </button>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">View only — agency admin or IT can edit mappings.</p>
        )}
        {saveMut.isSuccess ? <span className="text-[11px] text-emerald-300">Saved.</span> : null}
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
