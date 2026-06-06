"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { TranscriptSegment } from "rapid-cortex-shared";
import { TranscriptLine } from "@/components/dispatch/transcript-line";

export function TranscriptPanel({
  segments,
  autoScroll,
  onAutoScrollChange,
  isStreaming,
  isLoading,
  toolbar,
  className,
}: {
  segments: TranscriptSegment[];
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  isStreaming: boolean;
  isLoading: boolean;
  /** Optional strip under the header (e.g. simulated transcript stream controls). */
  toolbar?: ReactNode;
  /** Merged onto root `<section>` for CAD / alternate shells. */
  className?: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    // Smooth scrolling on every transcript tick is visually nice but CPU-heavy during bursts.
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [segments, autoScroll]);

  return (
    <section
      className={`flex min-w-0 flex-1 flex-col border-r border-slate-800 bg-slate-950 ${className ?? ""}`.trim()}
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Transcript
        </h2>
        <div className="flex items-center gap-3">
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-sky-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
              </span>
              Streaming
            </span>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => onAutoScrollChange(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
            />
            Auto-scroll
          </label>
        </div>
      </div>
      {toolbar ? (
        <div className="border-b border-slate-800 bg-slate-950/90 px-4 py-2">{toolbar}</div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-sm leading-relaxed">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-16 shrink-0 animate-pulse rounded bg-slate-800" />
                <div className="h-4 flex-1 animate-pulse rounded bg-slate-800" />
              </div>
            ))}
          </div>
        ) : segments.length === 0 ? (
          <p className="text-slate-500">No transcript lines yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {segments.map((seg) => (
              <TranscriptLine key={seg.segmentId} segment={seg} />
            ))}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>
    </section>
  );
}
