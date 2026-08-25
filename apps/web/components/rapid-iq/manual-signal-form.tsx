"use client";

import { useState } from "react";
import {
  RAPID_IQ_PROCUREMENT_STAGES,
  US_STATE_CODES,
  type CreateManualRapidIqPipelineSignalBody,
  type RapidIqProcurementStage,
} from "rapid-cortex-shared";
import { createManualPipelineSignal } from "@/lib/rapid-iq/pipeline-api";

const STAGES: RapidIqProcurementStage[] = [
  "rfp",
  "rfi-planning",
  "budget-funded",
  "early-awareness",
  "monitoring",
];

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export function ManualSignalForm({ onClose, onCreated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [state, setState] = useState("GA");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [procurementStage, setProcurementStage] = useState<RapidIqProcurementStage>("rfp");
  const [excerpt, setExcerpt] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: CreateManualRapidIqPipelineSignalBody = {
      manualEntry: true,
      agencyName: agencyName.trim(),
      state,
      title: title.trim(),
      sourceUrl: sourceUrl.trim(),
      sourceName: sourceName.trim() || undefined,
      documentDate: documentDate || undefined,
      deadline: deadline || undefined,
      estimatedValue: estimatedValue.trim() || undefined,
      procurementStage,
      excerpt: excerpt.trim() || undefined,
    };
    try {
      await createManualPipelineSignal(payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save signal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#0a1628] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Add signal</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Log a public-record opportunity (agency site, SAM.gov, board agenda, news). Manual
              Entry badge is applied automatically.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close">
            ×
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-[11px] text-slate-400 sm:col-span-2">
            Agency name
            <input
              required
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
          <label className="text-[11px] text-slate-400">
            State
            <select
              required
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            >
              {US_STATE_CODES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-slate-400">
            Procurement stage
            <select
              required
              value={procurementStage}
              onChange={(e) => setProcurementStage(e.target.value as RapidIqProcurementStage)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            >
              {STAGES.filter((s) => (RAPID_IQ_PROCUREMENT_STAGES as readonly string[]).includes(s)).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="text-[11px] text-slate-400 sm:col-span-2">
            Signal title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
          <label className="text-[11px] text-slate-400 sm:col-span-2">
            Source URL
            <input
              required
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
          <label className="text-[11px] text-slate-400">
            Source name
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="County website, SAM.gov, agenda…"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
          <label className="text-[11px] text-slate-400">
            Estimated value
            <input
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="$250,000"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
          <label className="text-[11px] text-slate-400">
            Document date
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
          <label className="text-[11px] text-slate-400">
            Deadline
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
          <label className="text-[11px] text-slate-400 sm:col-span-2">
            Description / excerpt
            <textarea
              maxLength={500}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-[11px] text-red-300">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save signal"}
          </button>
        </div>
      </form>
    </div>
  );
}
