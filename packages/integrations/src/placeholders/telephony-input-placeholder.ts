import type { TranscriptSegment } from "rapid-cortex-shared";
import type { AudioConnectionState, AudioInputAdapter } from "../audio-adapter.js";

export type ConnectMediaIngest = {
  contactId: string;
  ani?: string;
  aliAddress?: string;
  mediaStreamArn?: string;
};

/**
 * Live telephony ingest for Rapid Cortex is Amazon Connect, not a PSAP SIP/CPE
 * stack. Transcript chunks arrive from Connect (Lex, Contact Lens, or the
 * Call Assist webhook). ANI/ALI are contact attributes — see ani-ali ingest.
 */
export class AmazonConnectAudioInputAdapter implements AudioInputAdapter {
  readonly adapterId = "amazon-connect-audio";
  private transcriptHandlers = new Set<(chunk: Partial<TranscriptSegment>) => void>();
  private statusHandlers = new Set<(state: AudioConnectionState, detail?: string) => void>();
  private contactId: string | null = null;

  async startStream(incidentId: string): Promise<void> {
    this.contactId = incidentId;
    this.emitStatus("connected", "amazon-connect");
  }

  async stopStream(): Promise<void> {
    this.contactId = null;
    this.emitStatus("disconnected");
  }

  ingestConnectTranscript(text: string, at = new Date().toISOString()): void {
    if (!text.trim()) return;
    for (const handler of this.transcriptHandlers) {
      handler({ text, timestamp: at, speaker: "caller" });
    }
  }

  attachMediaFork(_ingest: ConnectMediaIngest): void {
    this.emitStatus("connected", _ingest.mediaStreamArn ? "kvs-media-fork" : "lex-native");
  }

  onTranscriptChunk(handler: (chunk: Partial<TranscriptSegment>) => void): () => void {
    this.transcriptHandlers.add(handler);
    return () => this.transcriptHandlers.delete(handler);
  }

  onConnectionStatus(handler: (state: AudioConnectionState, detail?: string) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private emitStatus(state: AudioConnectionState, detail?: string): void {
    for (const handler of this.statusHandlers) handler(state, detail);
  }
}

/** @deprecated Use AmazonConnectAudioInputAdapter. Kept so existing imports compile. */
export class TelephonyInputPlaceholder extends AmazonConnectAudioInputAdapter {
  readonly adapterId = "telephony-input-placeholder";
}
