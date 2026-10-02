import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ISpeechToTextProvider, SttChunkResult } from "./interfaces.js";
import { runSttChain } from "./stt/sttOrchestrator.js";
import { VoiceProviderError } from "./providerErrors.js";
import { VOICE_ERROR_CODES } from "./voiceErrorCodes.js";

class FlakyThenOk implements ISpeechToTextProvider {
  readonly name: string;
  private n = 0;
  constructor(name: string) {
    this.name = name;
  }
  async transcribeAudioChunk(): Promise<SttChunkResult> {
    this.n += 1;
    if (this.n === 1) {
      throw new VoiceProviderError("rate limited", VOICE_ERROR_CODES.STT_RATE_LIMIT);
    }
    return { transcript: "ok", languageCode: "en", confidence: 0.9, isPartial: false };
  }
}

describe("runSttChain", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries then succeeds on same provider when retryable", async () => {
    const p = new FlakyThenOk("p1");
    const out = await runSttChain(
      [p],
      { audioBytes: new Uint8Array([1, 2]), format: "pcm16le" },
      { maxRetries: 2, enableFallbacks: true },
    );
    expect(out.result.transcript).toBe("ok");
    expect(out.tierIndex).toBe(0);
  });

  it("falls back to second provider when first always fails", async () => {
    const bad: ISpeechToTextProvider = {
      name: "bad",
      async transcribeAudioChunk() {
        throw new VoiceProviderError("auth", VOICE_ERROR_CODES.STT_AUTH_ERROR);
      },
    };
    const good: ISpeechToTextProvider = {
      name: "good",
      async transcribeAudioChunk() {
        return { transcript: "hello", languageCode: "en", confidence: 0.8, isPartial: false };
      },
    };
    const out = await runSttChain(
      [bad, good],
      { audioBytes: new Uint8Array([1]), format: "pcm16le" },
      { maxRetries: 0, enableFallbacks: true },
    );
    expect(out.providerName).toBe("good");
    expect(out.tierIndex).toBe(1);
  });

  it("uses third provider when first two fail (non-retryable)", async () => {
    const p1: ISpeechToTextProvider = {
      name: "t0",
      async transcribeAudioChunk() {
        throw new VoiceProviderError("auth", VOICE_ERROR_CODES.STT_AUTH_ERROR);
      },
    };
    const p2: ISpeechToTextProvider = {
      name: "t1",
      async transcribeAudioChunk() {
        throw new VoiceProviderError("bad", VOICE_ERROR_CODES.STT_INVALID_RESPONSE);
      },
    };
    const p3: ISpeechToTextProvider = {
      name: "t2",
      async transcribeAudioChunk() {
        return { transcript: "aws ok", languageCode: "en", confidence: 0.7, isPartial: false };
      },
    };
    const out = await runSttChain(
      [p1, p2, p3],
      { audioBytes: new Uint8Array([1]), format: "pcm16le" },
      { maxRetries: 0, enableFallbacks: true },
    );
    expect(out.providerName).toBe("t2");
    expect(out.tierIndex).toBe(2);
  });
});
