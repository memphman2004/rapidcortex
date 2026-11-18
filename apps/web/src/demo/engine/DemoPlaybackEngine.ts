import { findStateViolations } from "./invariants";
import { applyDemoEvent, projectState } from "./reduce";
import { getScenario } from "../scenarios/registry";
import type {
  DemoAgencyState,
  DemoLogEntry,
  DemoScenarioManifest,
  DemoSnapshot,
  GuidedHighlight,
  PlaybackEngineEvent,
  PlaybackStatus,
} from "../types";
import { DEMO_AGENCY_ID } from "../types";

export interface DemoSocketMessage {
  type: string;
  data: Record<string, unknown>;
}

const SPEEDS = new Set([1, 2, 4]);

function cloneState(state: DemoAgencyState): DemoAgencyState {
  return structuredClone(state);
}

function toSocketMessage(scenario: DemoScenarioManifest, event: DemoScenarioManifest["events"][number]): DemoSocketMessage {
  return {
    type: "demo.event",
    data: {
      eventType: event.type,
      eventId: event.id,
      summary: event.summary,
      payload: event.payload,
      agencyId: DEMO_AGENCY_ID,
      scenarioId: scenario.id,
      offsetSeconds: event.relativeOffsetSeconds,
    },
  };
}

/**
 * Scripted clock for Maplewood County. The clock is not wall time: pause
 * freezes it, and 2× / 4× compress the gaps between events.
 */
export class DemoPlaybackEngine {
  private scenario: DemoScenarioManifest | null = null;
  private state: DemoAgencyState | null = null;
  private status: PlaybackStatus = "idle";
  private offsetSeconds = 0;
  private speed = 1;
  private fired = new Set<string>();
  private log: DemoLogEntry[] = [];
  private activeHighlight: GuidedHighlight | null = null;
  private highlightIndex = -1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private anchorWall = 0;
  private anchorOffset = 0;
  private listeners = new Map<PlaybackEngineEvent, Set<() => void>>();
  private sockets = new Set<(message: DemoSocketMessage) => void>();
  private snapshotListeners = new Set<() => void>();
  private snapshot: DemoSnapshot = this.buildSnapshot();
  private violations: string[] = [];

  load(scenarioId: string): Promise<void> {
    this.status = "loading";
    this.publish();
    const scenario = getScenario(scenarioId);
    if (!scenario || !scenario.enabled) {
      this.status = "idle";
      this.publish();
      return Promise.reject(new Error(`Unknown or disabled scenario ${scenarioId}`));
    }
    this.install(scenario);
    return Promise.resolve();
  }

  start(): void {
    if (!this.scenario || !this.state) return;
    if (this.status === "playing") return;
    const resuming = this.status === "paused";
    this.anchorWall = Date.now();
    this.anchorOffset = this.offsetSeconds;
    this.status = "playing";
    this.publish();
    this.emit(resuming ? "resumed" : "started");
    this.schedule();
  }

  pause(): void {
    if (this.status !== "playing") return;
    this.offsetSeconds = this.currentOffset();
    this.status = "paused";
    this.clearTimer();
    this.publish();
    this.emit("paused");
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.start();
  }

  reset(): void {
    if (!this.scenario) return;
    this.clearTimer();
    this.offsetSeconds = 0;
    this.fired.clear();
    this.log = [];
    this.activeHighlight = null;
    this.highlightIndex = -1;
    this.violations = [];
    this.state = cloneState(this.scenario.startingState);
    this.status = "idle";
    this.publish();
    this.emit("reset");
  }

  setSpeed(multiplier: number): void {
    if (!SPEEDS.has(multiplier)) {
      throw new Error("Demo playback speed must be 1, 2, or 4");
    }
    if (this.status === "playing") {
      this.offsetSeconds = this.currentOffset();
      this.anchorWall = Date.now();
      this.anchorOffset = this.offsetSeconds;
    }
    this.speed = multiplier;
    this.publish();
    if (this.status === "playing") this.schedule();
  }

  seek(offsetSeconds: number): void {
    if (!this.scenario) return;
    const target = Math.max(0, offsetSeconds);
    const wasPlaying = this.status === "playing";
    this.clearTimer();
    this.fired.clear();
    this.log = [];
    this.state = projectState(this.scenario.startingState, this.scenario.events, target);
    this.violations = findStateViolations(this.state);
    this.activeHighlight = null;
    for (const item of this.scenario.events) {
      if (item.relativeOffsetSeconds > target) break;
      this.fired.add(item.id);
      this.log.push({
        offsetSeconds: item.relativeOffsetSeconds,
        type: item.type,
        summary: item.summary,
        eventId: item.id,
      });
      this.noteHighlight(item.highlightId);
    }
    this.offsetSeconds = target;
    this.anchorOffset = target;
    this.anchorWall = Date.now();
    if (wasPlaying) {
      this.status = "playing";
      this.schedule();
    }
    this.publish();
  }

  getCurrentOffset(): number {
    return this.status === "playing" ? this.currentOffset() : this.offsetSeconds;
  }

  getStatus(): PlaybackStatus {
    return this.status;
  }

  getSpeed(): number {
    return this.speed;
  }

  getState(): DemoAgencyState | null {
    return this.state;
  }

  getLog(): readonly DemoLogEntry[] {
    return this.log;
  }

  getViolations(): readonly string[] {
    return this.violations;
  }

  getActiveHighlight(): GuidedHighlight | null {
    return this.activeHighlight;
  }

  dismissHighlight(): void {
    this.activeHighlight = null;
    this.publish();
    this.emit("highlight");
  }

  advanceHighlight(): void {
    const stops = this.manualStops();
    if (stops.length === 0) return;
    this.highlightIndex = Math.min(this.highlightIndex + 1, stops.length - 1);
    this.activeHighlight = stops[this.highlightIndex] ?? null;
    this.publish();
    this.emit("highlight");
  }

  jumpToHighlight(highlightId: string): void {
    const stops = this.manualStops();
    const index = stops.findIndex((stop) => stop.id === highlightId);
    if (index < 0) return;
    this.highlightIndex = index;
    this.activeHighlight = stops[index] ?? null;
    this.publish();
    this.emit("highlight");
  }

  on(event: PlaybackEngineEvent, handler: () => void): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler);
    this.listeners.set(event, set);
  }

  off(event: PlaybackEngineEvent, handler: () => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  addSocketListener(handler: (message: DemoSocketMessage) => void): () => void {
    this.sockets.add(handler);
    handler({
      type: "demo.snapshot",
      data: {
        agencyId: DEMO_AGENCY_ID,
        scenarioId: this.scenario?.id ?? "",
        status: this.status,
        offsetSeconds: this.offsetSeconds,
      },
    });
    return () => this.sockets.delete(handler);
  }

  subscribe(listener: () => void): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  getSnapshot(): DemoSnapshot {
    return this.snapshot;
  }

  dispose(): void {
    this.clearTimer();
    this.listeners.clear();
    this.sockets.clear();
    this.snapshotListeners.clear();
  }

  private install(scenario: DemoScenarioManifest): void {
    this.clearTimer();
    const events = [...scenario.events].sort((a, b) => a.relativeOffsetSeconds - b.relativeOffsetSeconds);
    this.scenario = { ...scenario, events };
    this.state = cloneState(scenario.startingState);
    this.offsetSeconds = 0;
    this.fired.clear();
    this.log = [];
    this.activeHighlight = null;
    this.highlightIndex = -1;
    this.violations = [];
    this.status = "idle";
    this.publish();
  }

  private manualStops(): GuidedHighlight[] {
    return (this.scenario?.guidedHighlights ?? []).filter((stop) => stop.triggerMode === "manual");
  }

  private noteHighlight(highlightId: string | undefined): void {
    if (!highlightId || !this.scenario) return;
    const highlight = this.scenario.guidedHighlights?.find((item) => item.id === highlightId);
    if (highlight?.triggerMode === "auto") this.activeHighlight = highlight;
  }

  private currentOffset(): number {
    const elapsedMs = Date.now() - this.anchorWall;
    return this.anchorOffset + (elapsedMs * this.speed) / 1000;
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private fireDue(): void {
    if (!this.scenario || !this.state) return;
    const due = this.scenario.events.filter(
      (item) => !this.fired.has(item.id) && item.relativeOffsetSeconds <= this.offsetSeconds + 0.0001,
    );
    for (const item of due) {
      this.state = applyDemoEvent(this.state, item);
      this.fired.add(item.id);
      this.log.push({
        offsetSeconds: item.relativeOffsetSeconds,
        type: item.type,
        summary: item.summary,
        eventId: item.id,
      });
      this.noteHighlight(item.highlightId);
      const message = toSocketMessage(this.scenario, item);
      this.sockets.forEach((handler) => handler(message));
      this.violations = findStateViolations(this.state);
    }
  }

  private schedule(): void {
    this.clearTimer();
    if (this.status !== "playing" || !this.scenario) return;
    if (this.scenario.manualAdvance) return;
    this.offsetSeconds = this.currentOffset();
    this.fireDue();
    const next = this.scenario.events.find((item) => !this.fired.has(item.id));
    if (!next) {
      this.status = "completed";
      this.publish();
      this.emit("completed");
      return;
    }
    const waitMs = Math.max(0, ((next.relativeOffsetSeconds - this.offsetSeconds) * 1000) / this.speed);
    this.timer = setTimeout(() => {
      this.offsetSeconds = next.relativeOffsetSeconds;
      this.anchorOffset = next.relativeOffsetSeconds;
      this.anchorWall = Date.now();
      this.fireDue();
      this.publish();
      this.emit("event_fired");
      this.schedule();
    }, waitMs);
    this.publish();
  }

  private emit(event: PlaybackEngineEvent): void {
    this.listeners.get(event)?.forEach((handler) => handler());
    this.listeners.get("changed")?.forEach((handler) => handler());
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot();
    this.snapshotListeners.forEach((listener) => listener());
  }

  private buildSnapshot(): DemoSnapshot {
    const duration = this.scenario?.events.reduce(
      (max, item) => Math.max(max, item.relativeOffsetSeconds),
      this.scenario?.estimatedDurationSeconds ?? 0,
    );
    return {
      status: this.status,
      scenarioId: this.scenario?.id ?? null,
      displayName: this.scenario?.displayName ?? null,
      offsetSeconds: this.offsetSeconds,
      durationSeconds: duration ?? 0,
      speed: this.speed,
      manualAdvance: this.scenario?.manualAdvance ?? false,
      log: this.log.slice(),
      state: this.state,
      activeHighlight: this.activeHighlight,
      highlightIndex: this.highlightIndex,
    };
  }
}

let singleton: DemoPlaybackEngine | null = null;

export function peekDemoPlaybackEngine(): DemoPlaybackEngine | null {
  return singleton;
}

export function getDemoPlaybackEngine(): DemoPlaybackEngine {
  if (!singleton) singleton = new DemoPlaybackEngine();
  return singleton;
}

export function resetDemoPlaybackEngineForTests(): void {
  singleton?.dispose();
  singleton = null;
}
