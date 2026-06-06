"use client";

import { useState } from "react";
import type { RequestIncidentMediaInput } from "rapid-cortex-shared";
import { postIncidentMediaRequest } from "@/lib/api";

export function IncidentMediaRequestModal({
  incidentId,
  open,
  onClose,
  onCreated,
}: {
  incidentId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [smsSummary, setSmsSummary] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    setErr(null);
    setBusy(true);
    setSmsSummary(null);
    try {
      const body: RequestIncidentMediaInput = { callerPhoneE164: phone.trim() };
      const out = await postIncidentMediaRequest(incidentId, body);
      const ok = out.smsOutcome.dispatchStatus === "sent";
      setSmsSummary(
        ok
          ? `Outbound SMS completed (${out.smsOutcome.provider}). Upload link expires ${new Date(out.smsOutcome.tokenExpiresAt).toLocaleString()}.`
          : `SMS failed (${out.smsOutcome.provider}${out.smsOutcome.errorCode ? `: ${out.smsOutcome.errorCode}` : ""}).`,
      );
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-xl">
        <h2 className="text-sm font-semibold text-white">Request caller media</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sends a one-time upload link (SMS). Caller must consent on the public page before upload.
        </p>
        <label className="mt-3 block text-xs text-slate-400">
          Caller mobile (E.164)
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
            className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100"
          />
        </label>
        {err ? (
          <p className="mt-2 text-xs text-rose-300" role="alert">
            {err}
          </p>
        ) : null}
        {smsSummary ? (
          <p className="mt-2 text-xs text-emerald-200/90" role="status">
            {smsSummary}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-900"
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy || phone.trim().length < 8}
            onClick={() => void submit()}
            className="rounded-md bg-sky-900/50 px-3 py-1.5 text-xs font-medium text-sky-200 ring-1 ring-sky-800 hover:bg-sky-900/70 disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send SMS"}
          </button>
        </div>
      </div>
    </div>
  );
}
