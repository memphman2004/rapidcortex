"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CadPriority, Incident } from "rapid-cortex-shared";
import {
  fetchCadIntegrations,
  fetchIncident,
  isApiConfigured,
  patchIncidentDispatch,
} from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isCadWritebackUiEnabled } from "@/lib/runtime-flags";

function formatLastCadSync(iso: string | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const m = Math.max(1, Math.round((Date.now() - t) / 60_000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

const PRIORITIES: CadPriority[] = ["P1", "P2", "P3", "P4"];

function cadSystemLabel(c: Incident["cadSystem"] | undefined): string {
  if (c === "motorola") return "Motorola PremierOne";
  if (c === "tyler") return "Tyler New World";
  if (c === "centralsquare") return "CentralSquare";
  if (c === "hexagon") return "Hexagon I/CAD";
  if (c === "generic") return "Generic CAD";
  return "CAD";
}

function parseCadPriority(v: string | undefined): CadPriority {
  const u = String(v ?? "").toUpperCase();
  if (u === "P1" || u === "P2" || u === "P3" || u === "P4") return u;
  if (u === "1" || u === "E") return "P1";
  if (u === "2") return "P2";
  if (u === "4") return "P4";
  return "P2";
}

export function CadEntryWorkspace({ incidentId }: { incidentId: string | null }) {
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const [manualMode, setManualMode] = useState(false);
  const [cadNumber, setCadNumber] = useState("");
  const [nature, setNature] = useState("");
  const [priority, setPriority] = useState<CadPriority>("P2");
  const [location, setLocation] = useState("");
  const [units, setUnits] = useState<string[]>([]);
  const [unitDraft, setUnitDraft] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerCallback, setCallerCallback] = useState("");
  const [narrative, setNarrative] = useState("");
  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const incidentQuery = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: () => fetchIncident(incidentId!),
    enabled: Boolean(incidentId && isApiConfigured()),
  });

  const integrationsQuery = useQuery({
    queryKey: ["cad-integrations"],
    queryFn: fetchCadIntegrations,
    enabled: isApiConfigured(),
  });

  const incident = incidentQuery.data ?? null;
  const isCadSourced = incident?.source === "cad";
  const readOnly = Boolean(isCadSourced && !manualMode);

  useEffect(() => {
    if (!incident) return;
    setCadNumber(incident.cadIncidentId ?? "");
    setNature(incident.cadNatureCode ?? incident.category.replace(/_/g, " "));
    setPriority(parseCadPriority(incident.cadPriority));
    setLocation(incident.cadLocation ?? incident.callerAddressLine ?? "");
    setUnits(incident.cadUnits ?? []);
    setCallerName(incident.cadCallerName ?? "");
    setCallerCallback("");
    setNarrative(incident.summary ?? "");
    setManualMode(false);
  }, [incident?.incidentId, incident]);

  const hasActiveIntegration = useMemo(() => {
    const items = integrationsQuery.data?.items ?? [];
    return items.some((i) => i.status === "active");
  }, [integrationsQuery.data?.items]);

  const writebackEnabled = isCadWritebackUiEnabled();

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!incidentId) throw new Error("Select an incident from the dashboard queue.");
      return patchIncidentDispatch(incidentId, {
        action: "cad_workspace_save",
        summary: narrative.slice(0, 500),
        cadNatureCode: nature,
        cadPriority: priority,
        cadLocation: location,
        cadUnits: units,
        cadCallerName: callerName || undefined,
        cadCallerCallback: callerCallback.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setToast({ tone: "ok", text: "Saved to Rapid Cortex." });
      await qc.invalidateQueries({ queryKey: ["incident", incidentId] });
    },
    onError: (e: Error) => setToast({ tone: "err", text: e.message }),
  });

  const addUnit = useCallback(() => {
    const t = unitDraft.trim();
    if (!t) return;
    setUnits((u) => (u.includes(t) ? u : [...u, t]));
    setUnitDraft("");
  }, [unitDraft]);

  const syncFromCad = useCallback(() => {
    void incidentQuery.refetch();
    setToast({ tone: "ok", text: "Refreshed from server." });
  }, [incidentQuery]);

  if (!isApiConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-300">
        <p className="text-sm">Configure the API to load CAD entry for an incident.</p>
      </div>
    );
  }

  if (!incidentId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-slate-300">
        <h1 className="text-xl font-semibold text-white">CAD Entry Workspace</h1>
        <p className="text-sm text-slate-400">
          Open this page from the dashboard with an incident selected, or append{" "}
          <code className="text-slate-200">?incident=&lt;id&gt;</code> to the URL.
        </p>
        <Link href={to("/dashboard")} className="text-sm text-sky-400 hover:text-sky-300">
          Go to dashboard
        </Link>
      </div>
    );
  }

  if (incidentQuery.isLoading) {
    return <div className="px-4 py-10 text-slate-400">Loading incident…</div>;
  }

  if (incidentQuery.isError || !incident) {
    return (
      <div className="px-4 py-10 text-rose-300">
        Could not load incident.{" "}
        <button type="button" className="text-sky-400 underline" onClick={() => void incidentQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-slate-100">
      <header className="flex flex-col gap-2 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">CAD Entry Workspace</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {isCadSourced ? (
              <span className="rounded-full border border-sky-600/50 bg-sky-950/40 px-2 py-0.5 font-medium text-sky-200">
                CAD sourced — {cadSystemLabel(incident.cadSystem)}
              </span>
            ) : null}
            <span>Last CAD sync: {formatLastCadSync(incident.cadLastSyncAt)}</span>
          </div>
        </div>
        {isCadSourced ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setManualMode((m) => !m)}
              className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-950/50"
            >
              {manualMode ? "Lock CAD fields" : "Manual mode"}
            </button>
            <button
              type="button"
              onClick={syncFromCad}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Sync with CAD
            </button>
          </div>
        ) : null}
      </header>

      {manualMode && isCadSourced ? (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
          Manual edits override CAD data until you sync again from the vendor feed.
        </div>
      ) : null}

      {toast ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${toast.tone === "ok" ? "border-emerald-800 text-emerald-100" : "border-rose-800 text-rose-100"}`}>
          {toast.text}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-white">Incident details</h2>
          <label className="block text-xs text-slate-400">
            CAD incident #
            <input
              value={cadNumber}
              onChange={(e) => setCadNumber(e.target.value)}
              readOnly={readOnly}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm read-only:opacity-70"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Call type / nature code
            <input
              value={nature}
              onChange={(e) => setNature(e.target.value)}
              readOnly={readOnly}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm read-only:opacity-70"
            />
          </label>
          <div>
            <p className="text-xs text-slate-400">Priority</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setPriority(p)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                    p === "P1" ? "border-rose-600/60 text-rose-200"
                    : p === "P2" ? "border-amber-600/60 text-amber-100"
                    : p === "P3" ? "border-sky-600/60 text-sky-100"
                    : "border-slate-600 text-slate-300"
                  } ${priority === p ? "ring-2 ring-sky-500/80" : ""}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-xs text-slate-400">
            Location / address
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              readOnly={readOnly}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm read-only:opacity-70"
            />
          </label>
          <div>
            <p className="text-xs text-slate-400">Assigned units</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {units.map((u) => (
                <span key={u} className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
                  {u}
                  {!readOnly ? (
                    <button type="button" className="text-rose-400 hover:text-rose-300" onClick={() => setUnits((x) => x.filter((y) => y !== u))}>
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
            {!readOnly ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={unitDraft}
                  onChange={(e) => setUnitDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addUnit();
                    }
                  }}
                  placeholder="Unit ID, Enter to add"
                  className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                />
                <button type="button" onClick={addUnit} className="rounded border border-slate-600 px-2 text-xs text-slate-200">
                  Add
                </button>
              </div>
            ) : null}
          </div>
          <label className="block text-xs text-slate-400">
            Caller name
            <input
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              readOnly={readOnly}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm read-only:opacity-70"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Caller callback #
            <input
              value={readOnly ? incident.cadCallerCallbackMasked ?? "—" : callerCallback}
              onChange={(e) => setCallerCallback(e.target.value)}
              readOnly={readOnly}
              placeholder={readOnly ? undefined : "Digits only — stored masked"}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm read-only:opacity-70"
            />
          </label>
          {isCadSourced ? (
            <p className="text-xs text-slate-500">
              CAD system: <span className="text-slate-300">{cadSystemLabel(incident.cadSystem)}</span>
            </p>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-white">CAD narrative</h2>
          <label className="block text-xs text-slate-400">
            Notes ({narrative.length}/500)
            <textarea
              value={narrative}
              maxLength={500}
              onChange={(e) => setNarrative(e.target.value)}
              readOnly={readOnly}
              rows={12}
              className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm read-only:opacity-70"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!writebackEnabled || !hasActiveIntegration || saveMut.isPending}
              title={
                !hasActiveIntegration ? "No active CAD integration"
                : !writebackEnabled ?
                  "CAD write-back is not enabled for this environment"
                : "Submit to CAD (write-back)"
              }
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-400 disabled:cursor-not-allowed"
            >
              Submit to CAD
            </button>
            <button
              type="button"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saveMut.isPending ? "Saving…" : "Save to RC only"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Approval workflows for vendor write-back will appear here when your agency enables supervisor review.
          </p>
        </section>
      </div>
    </div>
  );
}
