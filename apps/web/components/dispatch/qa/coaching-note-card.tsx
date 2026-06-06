"use client";

import type { CoachingNote } from "rapid-cortex-shared";

export function CoachingNoteCard({
  note,
  supervisorLabel,
  showAcknowledge,
  busy,
  onAcknowledge,
}: {
  note: CoachingNote;
  supervisorLabel?: string;
  showAcknowledge?: boolean;
  busy?: boolean;
  onAcknowledge?: () => void | Promise<void>;
}) {
  const when = new Date(note.createdAt).toLocaleString();

  return (
    <article className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">
            {supervisorLabel ?? note.supervisorId} · {when}
          </p>
          {note.incidentId ? (
            <p className="mt-0.5 font-mono text-[10px] text-slate-600">Incident {note.incidentId}</p>
          ) : null}
        </div>
        {showAcknowledge && onAcknowledge ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAcknowledge()}
            className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
          >
            Acknowledge
          </button>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{note.content}</p>
      {note.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300 ring-1 ring-slate-700"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
