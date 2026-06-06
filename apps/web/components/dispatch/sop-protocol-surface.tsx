"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getProtocolPackById, listProtocolPacks, type ProtocolStep } from "rapid-cortex-shared/protocol";
import type { Incident } from "rapid-cortex-shared/types";
import { isApiConfigured, patchIncidentDispatch, postSopDetect } from "@/lib/api";
import { isSopProtocolEnabled } from "@/lib/runtime-flags";

function confidenceLabel(c: number): string {
  return `${Math.round(Math.min(1, Math.max(0, c)) * 100)}%`;
}

export function SopProtocolSurface({ incidentId, incident }: { incidentId: string; incident: Incident | null }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const overlay = incident?.sopProtocolOverlay ?? null;

  const activePackId = useMemo(() => {
    if (!overlay) return null;
    return overlay.manualProtocolPackId ?? overlay.recommendedProtocolPackId;
  }, [overlay]);

  const pack = activePackId ? getProtocolPackById(activePackId) : null;
  const packIds = useMemo(() => listProtocolPacks().map((p) => p.id), []);

  if (!isSopProtocolEnabled() || !isApiConfigured()) return null;

  const refreshIncident = () => qc.invalidateQueries({ queryKey: ["incident", incidentId] });

  const runDetect = async () => {
    setBusy(true);
    try {
      await postSopDetect(incidentId);
      await refreshIncident();
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    setBusy(true);
    try {
      await patchIncidentDispatch(incidentId, { action: "sop_dismiss" });
      await refreshIncident();
    } finally {
      setBusy(false);
    }
  };

  const clearOverride = async () => {
    setBusy(true);
    try {
      await patchIncidentDispatch(incidentId, { action: "sop_clear_override" });
      await refreshIncident();
    } finally {
      setBusy(false);
    }
  };

  const setOverride = async (protocolPackId: string) => {
    setBusy(true);
    try {
      await patchIncidentDispatch(incidentId, { action: "sop_override", protocolPackId });
      await refreshIncident();
    } finally {
      setBusy(false);
    }
  };

  const toggleStep = async (stepId: string, completed: boolean) => {
    setBusy(true);
    try {
      await patchIncidentDispatch(incidentId, { action: "sop_toggle_step", stepId, completed });
      await refreshIncident();
    } finally {
      setBusy(false);
    }
  };

  if (!overlay?.recommendedProtocolPackId && !overlay?.manualProtocolPackId && !overlay?.incidentTypeLabel) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">SOP protocol assist</div>
        <p className="mt-1 text-xs text-slate-500">No auto-detected protocol yet for this incident.</p>
        <button
          type="button"
          disabled={busy}
          onClick={runDetect}
          className="mt-2 rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-50"
        >
          Run detection
        </button>
      </div>
    );
  }

  const dismissed = Boolean(overlay.dismissedAt);
  const completed = new Set(overlay.completedStepIds ?? []);

  return (
    <div
      className={`rounded-lg border p-3 ${
        dismissed ? "border-slate-800 bg-slate-950/20 opacity-70" : "border-indigo-900/50 bg-indigo-950/25"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-200/90">SOP-aware protocol</div>
        <span className="rounded-full bg-indigo-900/60 px-2 py-0.5 text-[10px] font-medium text-indigo-100 ring-1 ring-indigo-800">
          {confidenceLabel(overlay.confidence)} confidence
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-300">
        <span className="font-medium text-white">{overlay.incidentTypeLabel}</span>
        {overlay.manualProtocolPackId ? (
          <span className="ml-2 text-amber-200/90">· Manual pack</span>
        ) : null}
      </p>
      {dismissed ? (
        <p className="mt-2 text-[11px] text-slate-500">Card dismissed — run detection again to resurface.</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || dismissed}
          onClick={dismiss}
          className="rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:bg-slate-800 disabled:opacity-40"
        >
          Dismiss
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={runDetect}
          className="rounded-md bg-slate-900 px-2 py-1 text-xs text-sky-300 ring-1 ring-slate-700 hover:bg-slate-800 disabled:opacity-40"
        >
          Re-run
        </button>
        {overlay.manualProtocolPackId ? (
          <button
            type="button"
            disabled={busy}
            onClick={clearOverride}
            className="rounded-md bg-slate-900 px-2 py-1 text-xs text-amber-200 ring-1 ring-slate-700 hover:bg-slate-800 disabled:opacity-40"
          >
            Clear override
          </button>
        ) : null}
      </div>
      <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Manual override
        <select
          disabled={busy}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
          value={overlay.manualProtocolPackId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) void clearOverride();
            else void setOverride(v);
          }}
        >
          <option value="">— Auto recommendation —</option>
          {packIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      {pack?.steps?.length ? (
        <ol className="mt-3 space-y-2 border-t border-slate-800/80 pt-3">
          {([...pack.steps] as ProtocolStep[])
            .sort((a, b) => a.order - b.order)
            .map((step) => {
              const done = completed.has(step.id);
              return (
                <li key={step.id} className="flex gap-2 text-xs">
                  <input
                    type="checkbox"
                    disabled={busy || dismissed}
                    checked={done}
                    onChange={(e) => void toggleStep(step.id, e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className={done ? "text-slate-500 line-through" : "font-medium text-slate-200"}>
                      {step.title}
                    </div>
                    <p className="text-[11px] text-slate-500">{step.dispatcherPhrase}</p>
                  </div>
                </li>
              );
            })}
        </ol>
      ) : null}
    </div>
  );
}
