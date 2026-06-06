"use client";

import type { TranscriptSegment } from "rapid-cortex-shared";
import { formatTime } from "@/lib/format";

export function TranscriptLine({ segment }: { segment: TranscriptSegment }) {
  return (
    <li className="flex gap-3">
      <time
        className="w-20 shrink-0 text-[11px] text-slate-500 tabular-nums"
        dateTime={segment.timestamp}
      >
        {formatTime(segment.timestamp)}
      </time>
      <div className="min-w-0 flex-1">
        <span
          className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
            segment.speaker === "caller"
              ? "bg-sky-950 text-sky-300"
              : segment.speaker === "dispatcher"
                ? "bg-slate-800 text-slate-300"
                : segment.speaker === "system"
                  ? "bg-slate-800 text-slate-500"
                  : "bg-slate-800 text-slate-400"
          }`}
        >
          {segment.speaker}
        </span>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {segment.needsInterpreterReview ? (
              <span
                className="rounded bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-200 ring-1 ring-amber-800/60"
                title="Pipeline flagged this segment for human interpreter review — do not rely on automated translation alone."
              >
                Interpreter review
              </span>
            ) : null}
            {segment.lowConfidence ? (
              <span
                className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-400 ring-1 ring-slate-700"
                title="STT or translation confidence fell below the configured threshold — verify meaning with the caller or interpreter per SOP."
              >
                Low confidence
              </span>
            ) : null}
            {segment.transcriptConfidence != null && !segment.lowConfidence ? (
              <span
                className="text-[10px] text-slate-500 tabular-nums"
                title="Speech-to-text confidence for this segment (when reported by the pipeline)."
              >
                STT {Math.round(segment.transcriptConfidence * 100)}%
              </span>
            ) : null}
            {segment.translationConfidence != null ? (
              <span
                className="text-[10px] text-slate-500 tabular-nums"
                title="Machine translation confidence for this segment (when reported by the pipeline)."
              >
                Tr {Math.round(segment.translationConfidence * 100)}%
              </span>
            ) : null}
            {segment.sttFallbackUsed ? (
              <span className="text-[10px] font-medium uppercase text-slate-500">STT fallback</span>
            ) : null}
            {segment.translationFallbackUsed ? (
              <span className="text-[10px] font-medium uppercase text-slate-500">Translate fallback</span>
            ) : null}
            {segment.originalLanguage ? (
              <span className="text-[10px] text-slate-500">Lang {segment.originalLanguage}</span>
            ) : null}
          </div>
          {segment.originalTranscript &&
          segment.originalTranscript.trim() &&
          segment.originalTranscript.trim() !== segment.text.trim() ? (
            <p className="text-[11px] leading-snug text-slate-500">
              <span className="font-medium text-slate-600">Original: </span>
              {segment.originalTranscript}
            </p>
          ) : null}
          <span className="text-slate-200">{segment.text}</span>
        </div>
      </div>
    </li>
  );
}
