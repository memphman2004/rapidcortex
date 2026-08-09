"use client";

import { useState } from "react";
import type { RapidIqOpportunity } from "@/lib/rapid-iq/types";
import { convertToLead } from "@/lib/rapid-iq/api";

type Props = {
  opportunity: RapidIqOpportunity;
  demo?: boolean;
  onClose: () => void;
  onSuccess: (leadId: string) => void;
};

export function ConvertToLeadModal({ opportunity, demo = false, onClose, onSuccess }: Props) {
  const [assignee, setAssignee] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { leadId } = await convertToLead(
        {
          opportunityId: opportunity.opportunityId,
          assignee: assignee.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        demo,
      );
      onSuccess(leadId);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0d1b35] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
          <h2 className="text-sm font-bold text-slate-100">Add to Pipeline</h2>
          <button type="button" onClick={onClose} className="text-[#334155] transition hover:text-slate-300">
            ✕
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-xs text-slate-400">
            Convert <span className="font-semibold text-slate-200">{opportunity.agencyName}</span> to a
            Leads CRM record. {demo && "Demo mode returns a placeholder lead ID."}
          </p>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-600">
              Assignee (optional)
            </label>
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#080f1e] px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              placeholder="Sales rep name or email"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-600">
              Notes (optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#080f1e] px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              placeholder="Context for the CRM handoff…"
            />
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 transition hover:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="rounded-lg bg-sky-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-40"
          >
            {busy ? "Converting…" : "Convert to Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
