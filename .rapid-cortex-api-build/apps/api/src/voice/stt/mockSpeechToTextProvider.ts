import type { ISpeechToTextProvider, SttChunkResult } from "../interfaces.js";

/**
 * Deterministic STT for integration tests and near-real-time demos.
 * Encode `RC:<lang>|<transcript>` as UTF-8 bytes, then base64, as `audioBase64`.
 * Example: `RC:es|Necesito ayuda` → base64 → chunk body.
 */
export class MockSpeechToTextProvider implements ISpeechToTextProvider {
  readonly name: string;
  constructor(opts?: { name?: string }) {
    this.name = opts?.name ?? "mock-stt";
  }

  async transcribeAudioChunk(
    input: { audioBytes: Uint8Array; format: string; hintLanguage?: string },
  ): Promise<SttChunkResult> {
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(input.audioBytes).trim();
    if (decoded.startsWith("RC:")) {
      const rest = decoded.slice(3);
      const pipe = rest.indexOf("|");
      if (pipe > 0) {
        const languageCode = rest.slice(0, pipe).trim().toLowerCase();
        const transcript = rest.slice(pipe + 1).trim();
        return {
          transcript,
          languageCode: languageCode || input.hintLanguage || "en",
          confidence: 0.93,
          isPartial: false,
        };
      }
    }
    if (input.hintLanguage) {
      return {
        transcript: decoded || "(inaudible)",
        languageCode: input.hintLanguage,
        confidence: 0.55,
        isPartial: true,
      };
    }
    return {
      transcript: decoded || "(inaudible)",
      languageCode: "en",
      confidence: 0.45,
      isPartial: true,
    };
  }
}
