"use client";

import { useRef, useState } from "react";

type PricingSaveBarProps = {
  changeCount: number;
  targetLabel: string;
  saving: boolean;
  saveError: string | null;
  savedFlash: boolean;
  onDiscard: () => void;
  onSave: (reason: string) => void;
};

export function PricingSaveBar({
  changeCount,
  targetLabel,
  saving,
  saveError,
  savedFlash,
  onDiscard,
  onSave,
}: PricingSaveBarProps) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const reasonRef = useRef<HTMLInputElement>(null);

  if (changeCount === 0) return null;

  function handleSave() {
    if (reason.trim().length < 5) {
      setReasonError(true);
      reasonRef.current?.focus();
      return;
    }
    setReasonError(false);
    onSave(reason.trim());
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-700 bg-slate-950/95 px-4 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-slate-300">
          {changeCount} change{changeCount === 1 ? "" : "s"} to{" "}
          <strong className="text-white">{targetLabel}</strong>
        </p>
        <input
          ref={reasonRef}
          type="text"
          placeholder="Reason for change (required)"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (reasonError && e.target.value.trim().length >= 5) setReasonError(false);
          }}
          className={`min-w-0 flex-1 rounded-lg border bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 ${
            reasonError ? "border-red-500" : "border-slate-600"
          }`}
        />
        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="text-sm font-medium text-emerald-400">Saved</span>
          )}
          {saveError && <span className="text-sm text-red-400">{saveError}</span>}
          <button
            type="button"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900"
            onClick={onDiscard}
            disabled={saving}
          >
            Discard
          </button>
          <button
            type="button"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || reason.trim().length < 5}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
