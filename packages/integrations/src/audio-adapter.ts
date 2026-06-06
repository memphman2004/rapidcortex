import type { TranscriptSegment } from "rapid-cortex-shared";

export type AudioConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "degraded"
  | "error";

/** Vendor-neutral live audio → transcript bridge (telephony, console, SIP, etc.). */
export interface AudioInputAdapter {
  readonly adapterId: string;
  startStream(incidentId: string): Promise<void>;
  stopStream(): Promise<void>;
  onTranscriptChunk(handler: (chunk: Partial<TranscriptSegment>) => void): () => void;
  onConnectionStatus(handler: (state: AudioConnectionState, detail?: string) => void): () => void;
}
