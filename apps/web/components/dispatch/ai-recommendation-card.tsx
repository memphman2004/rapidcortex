"use client";

/** Highlighted “next best question” card — protocol-backed tone, assistive framing. */
export function AiRecommendationCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-sky-800/60 bg-sky-950/20 p-3 ring-1 ring-sky-900/40">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-300/90">
        Next question (suggested)
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug text-sky-100">{text}</p>
    </div>
  );
}
