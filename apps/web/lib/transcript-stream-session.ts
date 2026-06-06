/**
 * Client-side simulated stream phases (Phase 7). Maps to future `TranscriptStreamSessionState` from integrations.
 */
export type SimulatedTranscriptSessionPhase =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "interrupted";
