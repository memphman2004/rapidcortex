"use client";

import { useEffect, useState } from "react";
import type { QASession } from "rapid-cortex-shared";
import { patchQaSession } from "@/lib/api";

export function QaSupervisorNotes({
  session,
  readOnly,
  onSaved,
}: {
  session: QASession;
  readOnly?: boolean;
  onSaved?: (next: QASession) => void;
}) {
  const [text, setText] = useState(session.supervisorNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(session.supervisorNotes ?? "");
  }, [session.sessionId, session.supervisorNotes]);

  if (readOnly) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Supervisor notes</div>
        <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">
          {session.supervisorNotes?.trim() ? session.supervisorNotes : "—"}
        </p>
      </div>
    );
  }

  const dirty = text !== (session.supervisorNotes ?? "");

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await patchQaSession(session.sessionId, { supervisorNotes: text });
      onSaved?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Supervisor notes</div>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="mt-2 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-700"
        placeholder="Coaching feedback, follow-ups, or disposition context…"
      />
    </div>
  );
}
