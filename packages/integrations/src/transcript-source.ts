import type { TranscriptSegment } from "rapid-cortex-shared";

export type TranscriptStreamSessionState =
  | "idle"
  | "connecting"
  | "receiving"
  | "paused"
  | "ended"
  | "degraded";

/**
 * Abstraction for live transcription (Stage 2). Implementations may wrap AWS Transcribe Streaming,
 * vendor telephony bridges, or on-prem gateways — core product depends only on this contract.
 */
export interface TranscriptSourceAdapter {
  readonly adapterId: string;
  startSession(incidentId: string): Promise<void>;
  endSession(): Promise<void>;
  onPartial(handler: (text: string) => void): () => void;
  onFinal(handler: (segment: TranscriptSegment) => void): () => void;
  onSessionState(handler: (state: TranscriptStreamSessionState, detail?: string) => void): () => void;
}

/** Placeholder until Transcribe streaming is wired. */
export class AwsTranscribeStreamPlaceholder implements TranscriptSourceAdapter {
  readonly adapterId = "aws-transcribe-placeholder";

  async startSession(_incidentId: string): Promise<void> {
    /* no-op */
  }

  async endSession(): Promise<void> {
    /* no-op */
  }

  onPartial(_handler: (text: string) => void): () => void {
    return () => {};
  }

  onFinal(_handler: (segment: TranscriptSegment) => void): () => void {
    return () => {};
  }

  onSessionState(_handler: (state: TranscriptStreamSessionState, detail?: string) => void): () => void {
    return () => {};
  }
}
