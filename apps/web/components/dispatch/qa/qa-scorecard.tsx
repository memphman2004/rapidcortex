import type { QAChecklistItem, QASession, TranscriptSegment } from "rapid-cortex-shared";

function lineScore(c: QAChecklistItem): string {
  if (c.score != null) return `${c.score}/5`;
  if (c.passed === true) return "Pass";
  if (c.passed === false) return "Miss";
  return "—";
}

export function QaScorecard({
  session,
  transcriptPreview,
}: {
  session: QASession;
  /** Recent transcript lines for supervisor context alongside checklist evidence quotes. */
  transcriptPreview?: Pick<TranscriptSegment, "speaker" | "text">[];
}) {
  const preview = transcriptPreview?.slice(-10) ?? [];
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Scorecard</h3>
        {session.aggregateScore != null ? (
          <span className="text-sm font-semibold text-white">{session.aggregateScore}</span>
        ) : null}
      </div>
      <ul className="mt-2 divide-y divide-slate-800">
        {session.checklistItems.map((c) => (
          <li key={c.id} className="flex flex-col gap-0.5 py-2 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-slate-200">{c.label}</span>
              <span className="font-mono text-[11px] text-slate-400">{lineScore(c)}</span>
            </div>
            {c.notes ? <p className="text-[11px] leading-snug text-slate-500">{c.notes}</p> : null}
            {c.evidenceQuote ? (
              <blockquote className="mt-1 border-l-2 border-sky-800/80 pl-2 text-[11px] italic leading-snug text-sky-100/80">
                {c.evidenceQuote}
              </blockquote>
            ) : null}
          </li>
        ))}
      </ul>
      {preview.length > 0 ? (
        <div className="mt-3 border-t border-slate-800 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Transcript context (latest lines)
          </div>
          <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-[11px] text-slate-400">
            {preview.map((seg, idx) => (
              <li key={`${seg.speaker}-${idx}`} className="leading-snug">
                <span className="font-medium text-slate-500">{seg.speaker}:</span> {seg.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
