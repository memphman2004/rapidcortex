"use client";

import { useState } from "react";
import { isEscalationUiEnabled } from "@/lib/runtime-flags";

export function EscalateTo911Modal({
  incidentId,
  incidentType,
  locationDescription,
  onClose,
}: {
  incidentId: string;
  incidentType: string;
  locationDescription: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isEscalationUiEnabled()) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/escalations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId,
          incidentType,
          incidentDescription: `${incidentType} at ${locationDescription}`,
          incidentLocation: { description: locationDescription, section: locationDescription },
          incidentTimeline: [{ at: new Date().toISOString(), event: "Escalated to 911 from venue console" }],
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-950 p-5">
        <p className="text-sm font-semibold text-rose-300">Escalate to 911?</p>
        <p className="mt-2 text-xs text-slate-400">
          {incidentType} · {locationDescription}. This notifies the configured PSAP. Confirm only for
          true emergencies.
        </p>
        {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[52px] flex-1 rounded-lg border border-white/10 text-sm text-white/70"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="min-h-[52px] flex-1 rounded-lg bg-rose-600 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Confirm escalation"}
          </button>
        </div>
      </div>
    </div>
  );
}
