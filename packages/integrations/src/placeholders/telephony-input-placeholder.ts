import type { TranscriptSegment } from "rapid-cortex-shared";
import type { AudioConnectionState, AudioInputAdapter } from "../audio-adapter.js";

/** Future: SIPREC / vendor media stream → same chunk contract as mock audio. */
export class TelephonyInputPlaceholder implements AudioInputAdapter {
  readonly adapterId = "telephony-input-placeholder";

  async startStream(_incidentId: string): Promise<void> {}

  async stopStream(): Promise<void> {}

  onTranscriptChunk(_handler: (chunk: Partial<TranscriptSegment>) => void): () => void {
    return () => {};
  }

  onConnectionStatus(_handler: (state: AudioConnectionState, detail?: string) => void): () => void {
    return () => {};
  }
}
