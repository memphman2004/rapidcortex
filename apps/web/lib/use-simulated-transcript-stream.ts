"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sleep } from "@/lib/transcript-sim-stream";
import type { SimulatedTranscriptChunk } from "@/lib/transcript-sim-stream";
import type { SimulatedTranscriptSessionPhase } from "@/lib/transcript-stream-session";

export type SimulatedStreamHandlers = {
  onEmit: (chunk: SimulatedTranscriptChunk, index: number) => Promise<void>;
  onAnalysis: () => Promise<void>;
};

/**
 * Interval-based simulated transcript stream with pause/resume and optional
 * periodic analysis triggers (every N chunks after each emit).
 */
export function useSimulatedTranscriptStream({
  chunks,
  stepMs,
  analysisEveryNChunks,
  onEmit,
  onAnalysis,
}: {
  chunks: SimulatedTranscriptChunk[];
  stepMs: number;
  analysisEveryNChunks: number;
} & SimulatedStreamHandlers) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<SimulatedTranscriptSessionPhase>("idle");
  const runGenerationRef = useRef(0);
  const pausedRef = useRef(false);
  const onEmitRef = useRef(onEmit);
  const onAnalysisRef = useRef(onAnalysis);

  useEffect(() => {
    onEmitRef.current = onEmit;
  }, [onEmit]);

  useEffect(() => {
    onAnalysisRef.current = onAnalysis;
  }, [onAnalysis]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const reset = useCallback(() => {
    runGenerationRef.current += 1;
    setPlaying(false);
    setPaused(false);
    pausedRef.current = false;
    setVisibleCount(0);
    setPhase("idle");
  }, []);

  const start = useCallback(async () => {
    if (chunks.length === 0) return;
    runGenerationRef.current += 1;
    const gen = runGenerationRef.current;
    setPaused(false);
    pausedRef.current = false;
    setVisibleCount(0);
    setPlaying(true);
    setPhase("running");

    try {
      for (let i = 0; i < chunks.length; i++) {
        while (pausedRef.current && gen === runGenerationRef.current) {
          await sleep(80);
        }
        if (gen !== runGenerationRef.current) {
          setPhase("interrupted");
          return;
        }

        const chunk = chunks[i];
        if (!chunk) return;
        await onEmitRef.current(chunk, i);
        setVisibleCount(i + 1);

        if (
          analysisEveryNChunks > 0 &&
          (i + 1) % analysisEveryNChunks === 0 &&
          gen === runGenerationRef.current
        ) {
          await onAnalysisRef.current();
        }

        if (i < chunks.length - 1) {
          const delay = chunk.delayMs ?? stepMs;
          await sleep(delay);
        }
      }
      if (gen === runGenerationRef.current) {
        setPhase("completed");
      }
    } finally {
      if (gen === runGenerationRef.current) {
        setPlaying(false);
        setPaused(false);
        pausedRef.current = false;
      }
    }
  }, [chunks, stepMs, analysisEveryNChunks]);

  const togglePause = useCallback(() => {
    if (!playing) return;
    setPaused((p) => {
      const next = !p;
      pausedRef.current = next;
      setPhase(next ? "paused" : "running");
      return next;
    });
  }, [playing]);

  const isStreaming =
    playing && !paused && (visibleCount === 0 || visibleCount < chunks.length);

  return {
    visibleCount,
    playing,
    paused,
    isStreaming,
    phase,
    start,
    reset,
    togglePause,
  };
}
