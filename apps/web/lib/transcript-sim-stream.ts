import type { TranscriptSegment } from "rapid-cortex-shared";

export const DEFAULT_STREAM_STEP_MS = 2200;
export const DEFAULT_ANALYSIS_EVERY_N_CHUNKS = 3;

export type SimulatedTranscriptChunk = Pick<TranscriptSegment, "speaker" | "text"> & {
  /** Delay after this chunk before the next one (defaults to `stepMs` from the player). */
  delayMs?: number;
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildStreamPreviewSegments(
  chunks: SimulatedTranscriptChunk[],
  visibleCount: number,
  incidentId: string,
  agencyId: string,
  idPrefix: string,
  streamStepMs: number,
): TranscriptSegment[] {
  const slice = chunks.slice(0, visibleCount);
  const base = Date.now() - slice.length * streamStepMs;
  return slice.map((c, i) => ({
    segmentId: `${idPrefix}-${i}`,
    incidentId,
    agencyId,
    speaker: c.speaker,
    text: c.text,
    timestamp: new Date(base + i * streamStepMs).toISOString(),
  }));
}
