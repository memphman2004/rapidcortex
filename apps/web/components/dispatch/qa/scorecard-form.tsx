"use client";

import { useMemo, useState } from "react";
import type { QaScorecardItem } from "rapid-cortex-shared";
import { computeQaOverallScore, defaultQaScorecardItems } from "rapid-cortex-shared";

type FormPayload = {
  items: QaScorecardItem[];
  coachingNotes: string;
  followUpRequired: boolean;
};

export function ScorecardForm({
  initialItems,
  initialCoachingNotes,
  initialFollowUp,
  readOnly,
  busy,
  onSaveDraft,
  onSubmit,
}: {
  initialItems?: QaScorecardItem[];
  initialCoachingNotes?: string;
  initialFollowUp?: boolean;
  readOnly?: boolean;
  busy?: boolean;
  onSaveDraft?: (payload: FormPayload) => void | Promise<void>;
  onSubmit?: (payload: FormPayload) => void | Promise<void>;
}) {
  const [items, setItems] = useState<QaScorecardItem[]>(initialItems ?? defaultQaScorecardItems());
  const [coachingNotes, setCoachingNotes] = useState(initialCoachingNotes ?? "");
  const [followUpRequired, setFollowUpRequired] = useState(initialFollowUp ?? false);

  const overall = useMemo(() => computeQaOverallScore(items), [items]);

  const setScore = (category: QaScorecardItem["category"], score: 1 | 2 | 3 | 4 | 5) => {
    setItems((prev) => prev.map((row) => (row.category === category ? { ...row, score } : row)));
  };

  const payload: FormPayload = { items, coachingNotes, followUpRequired };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/80 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-200">Scorecard categories</h3>
          <span className="text-sm font-semibold text-sky-300">{overall.toFixed(1)} / 100</span>
        </div>
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.category} className="border-b border-slate-800/80 pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-200">{row.label}</p>
                  <p className="text-[10px] text-slate-500">Weight {(row.weight * 100).toFixed(0)}%</p>
                </div>
                <div className="flex gap-1" role="group" aria-label={`${row.label} rating`}>
                  {([1, 2, 3, 4, 5] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={readOnly || busy}
                      onClick={() => setScore(row.category, n)}
                      className={`h-7 w-7 rounded text-xs font-medium ring-1 transition ${
                        row.score >= n
                          ? "bg-amber-500/20 text-amber-200 ring-amber-600/50"
                          : "bg-slate-950 text-slate-500 ring-slate-700 hover:text-slate-300"
                      } disabled:opacity-40`}
                      aria-pressed={row.score >= n}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <label className="block text-xs text-slate-400">
        Coaching notes
        <textarea
          value={coachingNotes}
          onChange={(e) => setCoachingNotes(e.target.value)}
          disabled={readOnly || busy}
          rows={4}
          className="mt-1 w-full rounded-md border border-slate-700/60 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={followUpRequired}
          onChange={(e) => setFollowUpRequired(e.target.checked)}
          disabled={readOnly || busy}
          className="rounded border-slate-600"
        />
        Follow-up required
      </label>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          {onSaveDraft ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSaveDraft(payload)}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              Save draft
            </button>
          ) : null}
          {onSubmit ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSubmit(payload)}
              className="rounded-md bg-teal-950/80 px-3 py-1.5 text-xs font-medium text-teal-100 ring-1 ring-teal-800 hover:bg-teal-900/80 disabled:opacity-40"
            >
              Submit scorecard
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
