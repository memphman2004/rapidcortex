import { describe, expect, it, vi, afterEach } from "vitest";
import { OpenAiWhisperSttProvider } from "./openaiWhisperSttProvider.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { resetMultilingualVoiceConfigForTests } from "../multilingualConfig.js";
import { clearRuntimeSecretsCacheForTests } from "../../lib/runtimeSecrets.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";
import { toWhisperLanguageHint } from "./whisperLanguageMapping.js";

function baseCfg(over: Partial<MultilingualVoiceConfig> = {}): MultilingualVoiceConfig {
  return {
    supportedLanguages: new Set(["en", "es", "zh", "tl", "vi", "ar", "fr", "ko", "ru", "pt"]),
    languageDetectionMinConfidence: 0.65,
    sttMinConfidence: 0.55,
    translationMinConfidence: 0.6,
    callStreamChunkMs: 2000,
    maxTranscriptReorderWindowMs: 30_000,
    enableTranslationToEnglish: true,
    enableInterpreterEscalationFlag: true,
    autoFeedTranslatedTranscriptsToAnalysis: true,
    providerRequestTimeoutMs: 60_000,
    providerMaxRetries: 0,
    providerEnableFallbacks: true,
    primaryLanguageDetector: "mock",
    secondaryLanguageDetector: "mock",
    tertiaryLanguageDetector: "off",
    primarySttProvider: "azure",
    secondarySttProvider: "openai",
    tertiarySttProvider: "aws",
    primaryTranslationProvider: "mock",
    secondaryTranslationProvider: "mock",
    tertiaryTranslationProvider: "off",
    sttModelPrimary: "azure-stt-default",
    sttModelSecondary: "whisper-1",
    sttModelTertiary: "aws-transcribe-batch",
    translationModelPrimary: "x",
    translationModelSecondary: "x",
    translationModelTertiary: "x",
    languageDetectModelPrimary: "x",
    languageDetectModelSecondary: "x",
    languageDetectModelTertiary: "x",
    azureSpeechKey: "",
    azureSpeechKeySecretArn: "",
    azureSpeechRegion: "eastus",
    azureSpeechEndpoint: "",
    openAiApiKey: "sk-test",
    openAiApiKeySecretArn: "",
    openAiBaseUrl: "",
    openAiWhisperModel: "whisper-1",
    azureTranslatorKey: "",
    azureTranslatorKeySecretArn: "",
    azureTranslatorRegion: "eastus",
    googleCloudProjectId: "",
    googleCredentialsSecretArn: "",
    googleApplicationCredentialsJson: "",
    awsTranscribeRegion: "us-east-1",
    awsTranscribeLanguageIdentification: true,
    awsTranscribeLanguageOptionsCsv: "",
    awsTranscribePreferredLanguageOptionsCsv: "",
    awsTranscribeTimeoutMs: 90_000,
    awsTranscribeEnablePartialResults: false,
    awsTranslateRegion: "us-east-1",
    awsComprehendRegion: "us-east-1",
    assetsBucket: "bukkit",
    deploymentStage: "dev",
    languageProvider: "auto",
    googleTranslateLocation: "global",
    googleTtsLocation: "global",
    googleTtsOutputBucket: "",
    silentTextTranslationEnabled: true,
    silentTextTtsEnabled: false,
    ...over,
  } as MultilingualVoiceConfig;
}

function makeFetch(response: Partial<Response> & { jsonBody?: unknown; ok?: boolean; status?: number }): typeof fetch {
  return vi.fn(async () => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.jsonBody ?? {},
  })) as unknown as typeof fetch;
}

describe("OpenAiWhisperSttProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetMultilingualVoiceConfigForTests();
    clearRuntimeSecretsCacheForTests();
  });

  it("returns SttChunkResult on a successful verbose_json response", async () => {
    const fetchImpl = makeFetch({
      ok: true,
      status: 200,
      jsonBody: {
        text: "  hello world  ",
        language: "english",
        duration: 1.5,
        segments: [
          { id: 0, text: "hello", avg_logprob: Math.log(0.9) },
          { id: 1, text: "world", avg_logprob: Math.log(0.85) },
        ],
      },
    });
    const p = new OpenAiWhisperSttProvider(baseCfg(), { fetchImpl });

    const out = await p.transcribeAudioChunk({
      audioBytes: new Uint8Array([1, 2, 3, 4]),
      format: "pcm16le",
      hintLanguage: "en",
    });

    expect(out.transcript).toBe("hello world");
    expect(out.languageCode).toBe("en");
    expect(out.confidence).toBeGreaterThan(0.8);
    expect(out.confidence).toBeLessThanOrEqual(1);
    expect(out.isPartial).toBe(false);
    expect(out.sttModelUsed).toBe("whisper-1");
    expect(typeof out.sttProviderLatencyMs).toBe("number");
  });

  it("maps Whisper language name back to canonical ISO 639-1 (Spanish → es)", async () => {
    const fetchImpl = makeFetch({
      jsonBody: { text: "hola mundo", language: "spanish", segments: [] },
    });
    const p = new OpenAiWhisperSttProvider(baseCfg(), { fetchImpl });
    const out = await p.transcribeAudioChunk({
      audioBytes: new Uint8Array([1, 2]),
      format: "wav",
    });
    expect(out.languageCode).toBe("es");
  });

  it("falls back to hint when Whisper returns an unknown language name", async () => {
    const fetchImpl = makeFetch({
      jsonBody: { text: "...", language: "klingon", segments: [] },
    });
    const p = new OpenAiWhisperSttProvider(baseCfg(), { fetchImpl });
    const out = await p.transcribeAudioChunk({
      audioBytes: new Uint8Array([1, 2]),
      format: "wav",
      hintLanguage: "es",
    });
    expect(out.languageCode).toBe("es");
  });

  it("uses the hint as `language` form field for supported codes", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = init?.body as FormData;
      expect(body.get("language")).toBe("es");
      expect(body.get("model")).toBe("whisper-1");
      expect(body.get("response_format")).toBe("verbose_json");
      return {
        ok: true,
        status: 200,
        json: async () => ({ text: "hola", language: "spanish", segments: [] }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const p = new OpenAiWhisperSttProvider(baseCfg(), { fetchImpl });
    await p.transcribeAudioChunk({
      audioBytes: new Uint8Array([1, 2]),
      format: "wav",
      hintLanguage: "es-MX",
    });
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("throws PROVIDER_CONFIG_ERROR when no key or ARN is configured", async () => {
    const p = new OpenAiWhisperSttProvider(
      baseCfg({ openAiApiKey: "", openAiApiKeySecretArn: "" }),
      { fetchImpl: makeFetch({}) },
    );
    await expect(
      p.transcribeAudioChunk({ audioBytes: new Uint8Array([1, 2]), format: "wav" }),
    ).rejects.toMatchObject({
      code: VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR,
      retryable: false,
    });
  });

  it("classifies HTTP 401 as STT_AUTH_ERROR (non-retryable)", async () => {
    const fetchImpl = makeFetch({ ok: false, status: 401, jsonBody: { error: "bad key" } });
    const p = new OpenAiWhisperSttProvider(baseCfg(), { fetchImpl });
    await expect(
      p.transcribeAudioChunk({ audioBytes: new Uint8Array([1, 2]), format: "wav" }),
    ).rejects.toMatchObject({
      code: VOICE_ERROR_CODES.STT_AUTH_ERROR,
      retryable: false,
    });
  });

  it("classifies HTTP 429 as STT_RATE_LIMIT (retryable)", async () => {
    const fetchImpl = makeFetch({ ok: false, status: 429, jsonBody: {} });
    const p = new OpenAiWhisperSttProvider(baseCfg(), { fetchImpl });
    await expect(
      p.transcribeAudioChunk({ audioBytes: new Uint8Array([1, 2]), format: "wav" }),
    ).rejects.toMatchObject({
      code: VOICE_ERROR_CODES.STT_RATE_LIMIT,
      retryable: true,
    });
  });

  it("classifies HTTP 500 as STT_PROVIDER_5XX (retryable)", async () => {
    const fetchImpl = makeFetch({ ok: false, status: 503, jsonBody: {} });
    const p = new OpenAiWhisperSttProvider(baseCfg(), { fetchImpl });
    await expect(
      p.transcribeAudioChunk({ audioBytes: new Uint8Array([1, 2]), format: "wav" }),
    ).rejects.toMatchObject({
      code: VOICE_ERROR_CODES.STT_PROVIDER_5XX,
      retryable: true,
    });
  });

  it("classifies HTTP 413 as STT_INVALID_RESPONSE (non-retryable, payload too large)", async () => {
    const fetchImpl = makeFetch({ ok: false, status: 413, jsonBody: {} });
    const p = new OpenAiWhisperSttProvider(baseCfg(), { fetchImpl });
    await expect(
      p.transcribeAudioChunk({ audioBytes: new Uint8Array([1, 2]), format: "wav" }),
    ).rejects.toMatchObject({
      code: VOICE_ERROR_CODES.STT_INVALID_RESPONSE,
      retryable: false,
      httpStatus: 413,
    });
  });

  it("rejects empty transcript responses", async () => {
    const fetchImpl = makeFetch({ jsonBody: { text: "  ", language: "english", segments: [] } });
    const p = new OpenAiWhisperSttProvider(baseCfg(), { fetchImpl });
    await expect(
      p.transcribeAudioChunk({ audioBytes: new Uint8Array([1, 2]), format: "wav" }),
    ).rejects.toBeInstanceOf(VoiceProviderError);
  });

  it("respects abort signal and surfaces STT_TIMEOUT", async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;
    const p = new OpenAiWhisperSttProvider(baseCfg(), { fetchImpl });
    const ac = new AbortController();
    const promise = p.transcribeAudioChunk(
      { audioBytes: new Uint8Array([1, 2]), format: "wav" },
      { signal: ac.signal },
    );
    ac.abort();
    await expect(promise).rejects.toMatchObject({
      code: VOICE_ERROR_CODES.STT_TIMEOUT,
      retryable: true,
    });
  });

  it("uses configured model and base URL overrides", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("https://example-proxy.test/v1/audio/transcriptions");
      return {
        ok: true,
        status: 200,
        json: async () => ({ text: "ok", language: "english", segments: [] }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const p = new OpenAiWhisperSttProvider(
      baseCfg({
        openAiBaseUrl: "https://example-proxy.test/v1",
        openAiWhisperModel: "gpt-4o-mini-transcribe",
      }),
      { fetchImpl },
    );
    const out = await p.transcribeAudioChunk({ audioBytes: new Uint8Array([1, 2]), format: "wav" });
    expect(out.sttModelUsed).toBe("gpt-4o-mini-transcribe");
  });
});

describe("toWhisperLanguageHint", () => {
  it("passes through supported ISO 639-1 codes", () => {
    expect(toWhisperLanguageHint("en")).toBe("en");
    expect(toWhisperLanguageHint("es")).toBe("es");
    expect(toWhisperLanguageHint("zh")).toBe("zh");
    expect(toWhisperLanguageHint("tl")).toBe("tl");
    expect(toWhisperLanguageHint("pt")).toBe("pt");
  });

  it("normalizes BCP-47 to primary subtag", () => {
    expect(toWhisperLanguageHint("en-US")).toBe("en");
    expect(toWhisperLanguageHint("zh-Hans-CN")).toBe("zh");
    expect(toWhisperLanguageHint("pt-BR")).toBe("pt");
  });

  it("returns undefined for unknown / und / empty", () => {
    expect(toWhisperLanguageHint("und")).toBeUndefined();
    expect(toWhisperLanguageHint("")).toBeUndefined();
    expect(toWhisperLanguageHint(undefined)).toBeUndefined();
    expect(toWhisperLanguageHint("xx")).toBeUndefined();
  });
});
