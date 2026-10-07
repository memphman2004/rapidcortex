import { normalizeCallLanguageCode } from "rapid-cortex-shared";
import type { ISpeechToTextProvider, SttChunkResult } from "../interfaces.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { pcm16leMonoToWav } from "../audio/wavFromPcm16le.js";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import { VoiceProviderError, voiceErrorFromHttpStatus } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";
import { toWhisperLanguageHint } from "./whisperLanguageMapping.js";

/**
 * Shape of `response_format=verbose_json` from `/v1/audio/transcriptions`.
 * `language` is returned as the full English name (e.g. "english").
 */
type WhisperVerboseJson = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: WhisperSegment[];
};

type WhisperSegment = {
  id?: number;
  text?: string;
  avg_logprob?: number;
  no_speech_prob?: number;
  compression_ratio?: number;
};

/**
 * Whisper returns language as full English name in `verbose_json`. Map back to
 * ISO 639-1 for the canonical Rapid Cortex call-language space. Unknown names
 * fall back to `und`, which `normalizeCallLanguageCode` handles as unknown.
 */
const WHISPER_LANGUAGE_NAME_TO_ISO: Record<string, string> = {
  english: "en",
  spanish: "es",
  chinese: "zh",
  mandarin: "zh",
  cantonese: "zh",
  tagalog: "tl",
  filipino: "tl",
  vietnamese: "vi",
  arabic: "ar",
  french: "fr",
  korean: "ko",
  russian: "ru",
  portuguese: "pt",
  german: "de",
  italian: "it",
  japanese: "ja",
  hindi: "hi",
  dutch: "nl",
};

function mapWhisperLanguageToIso(whisperLang: string | undefined, hint: string | undefined): string {
  if (whisperLang) {
    const mapped = WHISPER_LANGUAGE_NAME_TO_ISO[whisperLang.trim().toLowerCase()];
    if (mapped) return mapped;
    if (/^[a-z]{2}$/i.test(whisperLang.trim())) return whisperLang.trim().toLowerCase();
  }
  return normalizeCallLanguageCode(hint);
}

/**
 * Derive a [0,1] confidence proxy from segment-level `avg_logprob` values.
 * Whisper does not expose an aggregate confidence; we approximate via
 * `exp(mean(avg_logprob))`, which is a standard token-probability proxy.
 * Returns `0.75` (matching the Azure provider) when no segments are present.
 */
function computeConfidenceFromSegments(segments: WhisperSegment[] | undefined): number {
  if (!segments || segments.length === 0) return 0.75;
  const probs = segments
    .map((s) => (typeof s.avg_logprob === "number" ? Math.exp(s.avg_logprob) : null))
    .filter((p): p is number => p !== null && Number.isFinite(p));
  if (probs.length === 0) return 0.75;
  const mean = probs.reduce((acc, x) => acc + x, 0) / probs.length;
  return Math.min(1, Math.max(0, mean));
}

function prepareAudioPayload(audioBytes: Uint8Array, format: string): { body: Uint8Array; filename: string; contentType: string } {
  if (format === "pcm16le") {
    return {
      body: pcm16leMonoToWav(audioBytes),
      filename: "chunk.wav",
      contentType: "audio/wav",
    };
  }
  if (format === "wav") {
    return { body: audioBytes, filename: "chunk.wav", contentType: "audio/wav" };
  }
  if (format === "webm") {
    return { body: audioBytes, filename: "chunk.webm", contentType: "audio/webm" };
  }
  if (format === "ogg" || format === "opus") {
    return { body: audioBytes, filename: "chunk.ogg", contentType: "audio/ogg" };
  }
  if (format === "mp3" || format === "mpeg") {
    return { body: audioBytes, filename: "chunk.mp3", contentType: "audio/mpeg" };
  }
  if (format === "m4a" || format === "mp4") {
    return { body: audioBytes, filename: "chunk.m4a", contentType: "audio/mp4" };
  }
  return {
    body: pcm16leMonoToWav(audioBytes),
    filename: "chunk.wav",
    contentType: "audio/wav",
  };
}

/** Default OpenAI API base URL; override via `OPENAI_BASE_URL` for tests / Azure OpenAI proxies. */
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_WHISPER_MODEL = "whisper-1";

export type OpenAiWhisperSttProviderOptions = {
  name?: string;
  /** Optional injected `fetch` for unit tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
};

/**
 * Speech-to-text provider backed by OpenAI's audio transcription API
 * (Whisper / `gpt-4o-transcribe` family). Used as the secondary tier in the
 * `azure → openai → aws` STT chain to provide vendor diversity from Azure
 * Speech (the primary).
 *
 * **Tenancy note:** No `agencyId` is sent to OpenAI. Per privacy posture, audio
 * leaving the VPC must already be sanitized of PII not required for transcription.
 *
 * **Cost note:** Whisper is priced per minute. Lambdas calling this provider
 * should clamp `audioBytes` length and rely on the orchestrator's budget gates.
 */
export class OpenAiWhisperSttProvider implements ISpeechToTextProvider {
  readonly name: string;
  private keyMemo: Promise<string> | null = null;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly cfg: MultilingualVoiceConfig,
    opts?: OpenAiWhisperSttProviderOptions,
  ) {
    this.name = opts?.name ?? "openai-whisper-stt";
    this.fetchImpl = opts?.fetchImpl ?? fetch;
  }

  private async resolveKey(): Promise<string> {
    this.keyMemo ??= resolvePlainOrSecretArn(this.cfg.openAiApiKey, this.cfg.openAiApiKeySecretArn, {
      preferredField: "apiKey",
    });
    const key = await this.keyMemo;
    if (!key) {
      throw new VoiceProviderError(
        "OpenAI API key missing (set OPENAI_API_KEY or OPENAI_API_KEY_SECRET_ARN)",
        VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR,
        { retryable: false },
      );
    }
    return key;
  }

  async transcribeAudioChunk(
    input: { audioBytes: Uint8Array; format: string; hintLanguage?: string },
    options?: { signal?: AbortSignal },
  ): Promise<SttChunkResult> {
    const key = await this.resolveKey();
    const baseUrl = (this.cfg.openAiBaseUrl?.trim() || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, "");
    const model = this.cfg.openAiWhisperModel?.trim() || DEFAULT_WHISPER_MODEL;
    const url = `${baseUrl}/audio/transcriptions`;
    const hint = toWhisperLanguageHint(input.hintLanguage);

    const { body, filename, contentType } = prepareAudioPayload(input.audioBytes, input.format);
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(body)], { type: contentType }), filename);
    form.set("model", model);
    form.set("response_format", "verbose_json");
    form.set("temperature", "0");
    if (hint) form.set("language", hint);

    const startedAt = Date.now();
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: options?.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new VoiceProviderError("OpenAI Whisper request aborted", VOICE_ERROR_CODES.STT_TIMEOUT, {
          retryable: true,
          cause: err,
        });
      }
      throw new VoiceProviderError(
        `OpenAI Whisper network error: ${err instanceof Error ? err.message : String(err)}`,
        VOICE_ERROR_CODES.STT_PROVIDER_5XX,
        { retryable: true, cause: err },
      );
    }

    if (!res.ok) {
      // 413 = file too large for Whisper (current limit is 25 MB).
      if (res.status === 413) {
        throw new VoiceProviderError(
          "OpenAI Whisper rejected payload as too large (>25MB)",
          VOICE_ERROR_CODES.STT_INVALID_RESPONSE,
          { httpStatus: 413, retryable: false },
        );
      }
      // 415 = unsupported media type — surface as invalid response (not retryable).
      if (res.status === 415) {
        throw new VoiceProviderError(
          "OpenAI Whisper rejected media type",
          VOICE_ERROR_CODES.STT_INVALID_RESPONSE,
          { httpStatus: 415, retryable: false },
        );
      }
      throw voiceErrorFromHttpStatus("stt", res.status, `OpenAI Whisper HTTP ${res.status}`);
    }

    let json: WhisperVerboseJson;
    try {
      json = (await res.json()) as WhisperVerboseJson;
    } catch (err) {
      throw new VoiceProviderError(
        "OpenAI Whisper returned non-JSON body",
        VOICE_ERROR_CODES.STT_INVALID_RESPONSE,
        { retryable: false, cause: err },
      );
    }

    const transcript = (json.text ?? "").trim();
    if (!transcript) {
      throw new VoiceProviderError(
        "OpenAI Whisper empty transcript",
        VOICE_ERROR_CODES.STT_INVALID_RESPONSE,
        { retryable: false },
      );
    }

    const languageCode = mapWhisperLanguageToIso(json.language, input.hintLanguage);
    const confidence = computeConfidenceFromSegments(json.segments);
    const sttProviderLatencyMs = Date.now() - startedAt;

    return {
      transcript,
      languageCode,
      confidence,
      isPartial: false,
      sttModelUsed: model,
      sttProviderLatencyMs,
    };
  }
}
