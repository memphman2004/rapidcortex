"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CategoryBadge } from "@/components/dispatch/badges";
import { DEMO_TRANSCRIPT_CHUNKS } from "@/lib/demo-scenarios";
import { isApiConfigured } from "@/lib/api";
import { loadDemoScenarios } from "@/lib/queries";
import {
  DEFAULT_ANALYSIS_EVERY_N_CHUNKS,
  DEFAULT_STREAM_STEP_MS,
  type SimulatedTranscriptChunk,
} from "@/lib/transcript-sim-stream";
import { useSimulatedTranscriptStream } from "@/lib/use-simulated-transcript-stream";
import type { IncidentCategory } from "rapid-cortex-shared";

export type TranscriptChunkPlayerProps = {
  /** When true, controls are disabled and any active stream is reset. */
  disabled?: boolean;
  /** Reset stream when this value changes (e.g. selected incident id). */
  resetKey?: string | null;
  onEmit: (chunk: SimulatedTranscriptChunk, index: number) => Promise<void>;
  onAnalysis: () => Promise<void>;
  stepMs?: number;
  analysisEveryNChunks?: number;
  defaultScenarioId?: string;
  /** Notified when streaming state changes (for transcript pulse + session phase). */
  onStreamState?: (state: {
    isStreaming: boolean;
    phase: import("@/lib/transcript-stream-session").SimulatedTranscriptSessionPhase;
  }) => void;
};

/**
 * Simulated transcript stream controls: scenario script, interval playback,
 * pause/resume, and hooks for persistence + incremental analysis.
 */
export function TranscriptChunkPlayer({
  disabled = false,
  resetKey,
  onEmit,
  onAnalysis,
  stepMs = DEFAULT_STREAM_STEP_MS,
  analysisEveryNChunks = DEFAULT_ANALYSIS_EVERY_N_CHUNKS,
  defaultScenarioId = "cardiac-arrest",
  onStreamState,
}: TranscriptChunkPlayerProps) {
  const scenariosQuery = useQuery({
    queryKey: ["demo-scenarios"],
    queryFn: loadDemoScenarios,
  });

  const playable = useMemo(() => {
    const rows = scenariosQuery.data ?? [];
    return rows.filter((s) => (DEMO_TRANSCRIPT_CHUNKS[s.id]?.length ?? 0) > 0);
  }, [scenariosQuery.data]);

  const [scenarioId, setScenarioId] = useState<string | null>(null);

  useEffect(() => {
    if (scenarioId !== null) return;
    const preferred = playable.some((s) => s.id === defaultScenarioId)
      ? defaultScenarioId
      : playable[0]?.id;
    if (preferred) setScenarioId(preferred);
  }, [playable, scenarioId, defaultScenarioId]);

  const chunks = useMemo(
    () => (scenarioId ? (DEMO_TRANSCRIPT_CHUNKS[scenarioId] ?? []) : []),
    [scenarioId],
  );

  const {
    reset,
    start,
    togglePause,
    visibleCount,
    playing,
    paused,
    isStreaming,
    phase,
  } = useSimulatedTranscriptStream({
    chunks,
    stepMs,
    analysisEveryNChunks,
    onEmit,
    onAnalysis,
  });

  useEffect(() => {
    if (disabled) {
      reset();
    }
  }, [disabled, reset]);

  useEffect(() => {
    reset();
  }, [resetKey, reset]);

  useEffect(() => {
    onStreamState?.({ isStreaming, phase });
  }, [isStreaming, phase, onStreamState]);

  const busy = playing && !paused;

  const apiLive = isApiConfigured();

  return (
    <div className="flex flex-col gap-2">
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Training transcript stream
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scenarioId ?? ""}
            onChange={(e) => {
              reset();
              setScenarioId(e.target.value || null);
            }}
            disabled={disabled || playable.length === 0}
            className="max-w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 disabled:opacity-40"
          >
            {playable.length === 0 ? (
              <option value="">No scripted scenarios</option>
            ) : null}
            {playable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {scenarioId ? (
            <CategoryBadge
              value={
                (playable.find((s) => s.id === scenarioId)?.category ??
                  "unknown") as IncidentCategory
              }
            />
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || chunks.length === 0 || busy}
          onClick={() => void start()}
          className="rounded-md bg-sky-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-40"
        >
          Start stream
        </button>
        <button
          type="button"
          disabled={disabled || !playing}
          onClick={() => togglePause()}
          className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => reset()}
          className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
        >
          Reset
        </button>
        <span className="text-[11px] text-slate-500">
          {visibleCount}/{chunks.length} · {stepMs / 1000}s · AI every {analysisEveryNChunks || "—"} ·{" "}
          <span className="font-medium text-slate-400">{phase}</span>
        </span>
      </div>
    </div>
      <p className="text-[11px] leading-snug text-slate-500">
        {apiLive
          ? "Chunks are written to the live transcript API (POST /transcript) for the selected incident."
          : "Local preview only: enable API configuration so streamed chunks persist to your backend."}
      </p>
    </div>
  );
}
