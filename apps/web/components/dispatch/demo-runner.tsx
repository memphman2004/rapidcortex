"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AiRecommendationPanel } from "@/components/dispatch/ai-panel";
import { CategoryBadge } from "@/components/dispatch/badges";
import { TranscriptPanel } from "@/components/dispatch/transcript-panel";
import { isApiConfigured, postDemoStart } from "@/lib/api";
import { buildDemoAiAnalysis } from "@/lib/demo-ai-preview";
import { DEMO_TRANSCRIPT_CHUNKS } from "@/lib/demo-scenarios";
import { loadDemoScenarios } from "@/lib/queries";
import {
  buildStreamPreviewSegments,
} from "@/lib/transcript-sim-stream";
import { useSimulatedTranscriptStream } from "@/lib/use-simulated-transcript-stream";
import type { Incident, IncidentCategory, TranscriptSegment } from "rapid-cortex-shared";

const STEP_MS = 2200;

export function DemoRunner() {
  const scenariosQuery = useQuery({
    queryKey: ["demo-scenarios"],
    queryFn: loadDemoScenarios,
  });

  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [analysisReplayKey, setAnalysisReplayKey] = useState(0);

  const chunks = useMemo(
    () => (scenarioId ? (DEMO_TRANSCRIPT_CHUNKS[scenarioId] ?? []) : []),
    [scenarioId],
  );

  const noopEmit = useCallback(async () => {}, []);
  const noopAnalysis = useCallback(async () => {}, []);

  const {
    visibleCount,
    playing,
    paused,
    isStreaming,
    start,
    reset,
    togglePause,
    phase,
  } = useSimulatedTranscriptStream({
    chunks,
    stepMs: STEP_MS,
    analysisEveryNChunks: 0,
    onEmit: noopEmit,
    onAnalysis: noopAnalysis,
  });

  useEffect(() => {
    reset();
    setAnalysisReplayKey((k) => k + 1);
  }, [scenarioId, reset]);

  const lines: TranscriptSegment[] = useMemo(
    () =>
      buildStreamPreviewSegments(
        chunks,
        visibleCount,
        "demo-playback",
        "demo-agency",
        scenarioId ?? "demo",
        STEP_MS,
      ),
    [chunks, visibleCount, scenarioId],
  );

  const analysis = scenarioId ? buildDemoAiAnalysis(scenarioId) : null;

  const demoIncident: Incident | null = useMemo(() => {
    if (!scenarioId) return null;
    const now = new Date().toISOString();
    return {
      incidentId: `demo-${scenarioId}`,
      agencyId: "demo-agency",
      title: `Demo scenario · ${scenarioId}`,
      category: "unknown",
      urgency: "moderate",
      status: "active",
      source: "demo",
      confidence: null,
      escalationFlag: false,
      summary: analysis?.summary ?? "",
      createdAt: now,
      updatedAt: now,
    };
  }, [analysis?.summary, scenarioId]);

  const handleStart = async () => {
    if (!scenarioId || chunks.length === 0) return;
    if (isApiConfigured()) {
      try {
        await postDemoStart(scenarioId);
      } catch {
        /* optional */
      }
    }
    await start();
  };

  const busy = playing && !paused;

  const fullReset = () => {
    reset();
    setScenarioId(null);
    setAnalysisReplayKey((k) => k + 1);
  };

  const scenarios = scenariosQuery.data ?? [];
  const progressLabel =
    chunks.length > 0 ? `${visibleCount} / ${chunks.length} lines` : "No script loaded";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-4 overflow-hidden p-4">
      <div className="relative overflow-hidden rounded-lg border border-amber-800/60 bg-gradient-to-r from-amber-950/90 via-amber-950/50 to-slate-950 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-950/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-lg"
              aria-hidden
            >
              ⏺
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                  Demo mode
                </div>
                <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  {phase}
                </span>
                <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300">
                  {progressLabel}
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-snug text-amber-100/95">
                Scenario library and simulated transcript playback for sales, training, and UI
                validation. No live 911 audio, CAD, or production traffic.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fullReset}
            className="shrink-0 rounded-md border border-amber-700/60 bg-amber-950/80 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/90"
          >
            Reset demo
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Scenario library
          </h2>
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto lg:max-h-none">
            {scenariosQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading scenarios…</p>
            ) : scenariosQuery.isError ? (
              <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                Could not load scenarios from the API. Offline catalog is unavailable — check
                network or sign in.
              </div>
            ) : scenarios.length === 0 ? (
              <p className="text-sm text-slate-500">No scenarios available.</p>
            ) : (
              scenarios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setScenarioId(s.id);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    scenarioId === s.id
                      ? "border-sky-600 bg-slate-800"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <div className="font-medium text-slate-100">{s.name}</div>
                  {"valuePitch" in s && s.valuePitch ? (
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">{s.valuePitch}</p>
                  ) : null}
                  <div className="mt-1">
                    <CategoryBadge value={s.category as IncidentCategory} />
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
            <button
              type="button"
              disabled={!scenarioId || busy}
              onClick={() => void handleStart()}
              className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-40"
            >
              Start
            </button>
            <button
              type="button"
              disabled={!playing}
              onClick={() => togglePause()}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              disabled={!scenarioId || !analysis}
              onClick={() => setAnalysisReplayKey((k) => k + 1)}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
            >
              Replay AI
            </button>
            <button
              type="button"
              onClick={fullReset}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700"
            >
              Reset
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Playback controls: one line every {STEP_MS / 1000}s via the shared chunk stream
            scheduler. Use <span className="font-medium text-slate-400">Reset demo</span> in the
            banner to clear scenario and playback instantly.
          </p>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-800 lg:flex-row">
          <TranscriptPanel
            segments={lines}
            autoScroll={autoScroll}
            onAutoScrollChange={setAutoScroll}
            isStreaming={isStreaming}
            isLoading={false}
          />
          <AiRecommendationPanel
            key={`${scenarioId ?? "none"}-${analysisReplayKey}`}
            incidentId={scenarioId ? `demo-${scenarioId}` : null}
            incident={demoIncident}
            analysis={analysis}
            assistiveLabel="Demo AI preview (not live model output)"
          />
        </div>
      </div>
    </div>
  );
}
