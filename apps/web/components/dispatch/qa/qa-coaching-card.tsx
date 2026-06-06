import type { QASession } from "rapid-cortex-shared";

/** Surfaces model rationales as coaching bullets (no extra model call). */
export function QaCoachingCard({ session }: { session: QASession }) {
  const tips = session.checklistItems
    .map((c) => {
      const note = c.notes?.trim();
      if (!note) return null;
      return { id: c.id, label: c.label, note };
    })
    .filter(Boolean) as { id: string; label: string; note: string }[];

  if (tips.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/30 p-3 text-xs text-slate-500">
        Run scoring to populate AI coaching notes per checklist line.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-teal-900/40 bg-teal-950/20 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-300/90">AI coaching</div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        Structured scorer rationales — assistive only; follow agency QA policy.
      </p>
      <ul className="mt-2 space-y-2">
        {tips.map((t) => (
          <li key={t.id} className="text-xs leading-snug text-slate-200">
            <span className="font-medium text-teal-100/90">{t.label}:</span> {t.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
