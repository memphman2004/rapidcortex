"use client";

import { useState } from "react";
import type { TriageClassification } from "rapid-cortex-shared/triage/triage";
import { postTriageEscalation } from "@/lib/api";

export function TriageOverrideModal({
  incidentId,
  currentClassification,
  confidence,
  reasoning,
  onSuccess,
  onClose,
}: {
  incidentId: string;
  currentClassification: TriageClassification;
  confidence: number;
  reasoning: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await postTriageEscalation({ incidentId, reason: reason.trim() || undefined });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 p-7 shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Override AI triage</p>
        <h2 className="mt-1 text-lg font-bold text-white">Escalate to emergency</h2>

        <div className="mt-5 rounded-lg border border-slate-800 border-l-amber-500 bg-slate-900/80 p-3">
          <p className="text-[9px] uppercase tracking-widest text-slate-500">AI classified as</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-amber-300">{currentClassification}</span>
            <span className="text-xs text-slate-400">{confidence}% confidence</span>
          </div>
          {reasoning ? <p className="mt-2 text-xs leading-relaxed text-slate-400">{reasoning}</p> : null}
        </div>

        <p className="mt-4 rounded-lg border border-red-500/25 bg-red-950/20 p-3 text-xs leading-relaxed text-red-200">
          This moves the call back to active emergency handling and is logged for audit.
        </p>

        <label htmlFor="triage-override-reason" className="mt-4 block text-[10px] uppercase tracking-widest text-slate-500">
          Reason (optional)
        </label>
        <textarea
          id="triage-override-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Caller tone changed, additional threat indicator…"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/0 focus:ring-2 focus:ring-sky-500/40"
        />

        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? "Escalating…" : "Confirm escalation"}
          </button>
        </div>
      </div>
    </div>
  );
}
