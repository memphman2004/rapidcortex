"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TRIAGE_BUCKETS, type TriageResult } from "rapid-cortex-shared/triage/triage";
import { fetchTriage, isApiConfigured, postTriageOverride } from "@/lib/api";
import { isNonEmergencyTriageEnabled } from "@/lib/runtime-flags";

export function NonEmergencyTriageStrip({ incidentId }: { incidentId: string | null }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["triage", incidentId],
    queryFn: () => (incidentId ? fetchTriage(incidentId) : Promise.resolve(null)),
    enabled: Boolean(incidentId) && isApiConfigured() && isNonEmergencyTriageEnabled(),
  });

  if (!isNonEmergencyTriageEnabled() || !isApiConfigured() || !incidentId) return null;

  const triage = q.data as TriageResult | null | undefined;

  const override = async (bucket: TriageResult["bucket"]) => {
    setBusy(true);
    try {
      await postTriageOverride(incidentId, { bucket });
      await qc.invalidateQueries({ queryKey: ["triage", incidentId] });
      await qc.invalidateQueries({ queryKey: ["analysis", incidentId] });
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) {
    return <p className="text-[11px] text-slate-500">Loading triage…</p>;
  }
  if (!triage) {
    return <p className="text-[11px] text-slate-500">No triage snapshot yet for this incident.</p>;
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-violet-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200 ring-1 ring-violet-900">
          Triage · {triage.bucket.replace(/_/g, " ")}
        </span>
        <span className="text-[10px] text-slate-500">{Math.round(triage.confidence * 100)}% confidence</span>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-200">{triage.headline}</p>
      <p className="mt-1 text-[11px] text-slate-500" title={triage.reasoning}>
        {triage.reasoning.length > 160 ? `${triage.reasoning.slice(0, 160)}…` : triage.reasoning}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Override</span>
        <select
          disabled={busy}
          className="max-w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
          value=""
          onChange={(e) => {
            const v = e.target.value as TriageResult["bucket"];
            if (!v) return;
            void override(v);
            e.target.value = "";
          }}
        >
          <option value="">Choose disposition…</option>
          {TRIAGE_BUCKETS.map((b) => (
            <option key={b} value={b}>
              {b.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
