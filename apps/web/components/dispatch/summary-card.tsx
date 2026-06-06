"use client";

export function SummaryCard({ summary }: { summary: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Summary</div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{summary}</p>
    </div>
  );
}
