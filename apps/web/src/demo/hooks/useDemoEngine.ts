"use client";

import { useSyncExternalStore } from "react";
import { getDemoPlaybackEngine } from "../engine/DemoPlaybackEngine";
import { isDemoModeActive, subscribeDemoMode } from "../engine/demo-mode-gate";
import type { DemoSnapshot, GuidedHighlight } from "../types";

const idleSnapshot: DemoSnapshot = {
  status: "idle",
  scenarioId: null,
  displayName: null,
  offsetSeconds: 0,
  durationSeconds: 0,
  speed: 1,
  manualAdvance: false,
  log: [],
  state: null,
  activeHighlight: null,
  highlightIndex: -1,
};

export function useDemoModeActive(): boolean {
  return useSyncExternalStore(subscribeDemoMode, isDemoModeActive, () => false);
}

export function usePlaybackEngine(): DemoSnapshot {
  const engine = getDemoPlaybackEngine();
  return useSyncExternalStore(engine.subscribe.bind(engine), engine.getSnapshot.bind(engine), () => idleSnapshot);
}

export function useDemoHighlight(): GuidedHighlight | null {
  return usePlaybackEngine().activeHighlight;
}
