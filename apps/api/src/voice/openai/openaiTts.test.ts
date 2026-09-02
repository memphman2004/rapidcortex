import { afterEach, describe, expect, it, vi } from "vitest";
import { openaiTtsSynthesize } from "./openaiTts.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { resetMultilingualVoiceConfigForTests } from "../multilingualConfig.js";

function cfg(over: Partial<MultilingualVoiceConfig> = {}): MultilingualVoiceConfig {
  return {
    supportedLanguages: new Set(["en", "es"]),
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
    primaryLanguageDetector: "azure",
    secondaryLanguageDetector: "aws",
    tertiaryLanguageDetector: "off",
    primarySttProvider: "azure",
    secondarySttProvider: "openai",
    tertiarySttProvider: "aws",
    primaryTranslationProvider: "azure",
    secondaryTranslationProvider: "aws",
    tertiaryTranslationProvider: "off",
    sttModelPrimary: "azure",
    sttModelSecondary: "whisper",
    sttModelTertiary: "transcribe",
    translationModelPrimary: "azure",
    translationModelSecondary: "aws",
    translationModelTertiary: "",
    languageDetectModelPrimary: "azure",
    languageDetectModelSecondary: "aws",
    languageDetectModelTertiary: "",
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
    awsTranscribeTimeoutMs: 0,
    awsTranscribeEnablePartialResults: false,
    awsTranslateRegion: "us-east-1",
    awsComprehendRegion: "us-east-1",
    assetsBucket: "",
    deploymentStage: "dev",
    languageProvider: "auto",
    googleTranslateLocation: "global",
    googleTtsLocation: "global",
    googleTtsOutputBucket: "",
    silentTextTranslationEnabled: true,
    silentTextTtsEnabled: true,
    ...over,
  };
}

describe("openaiTtsSynthesize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetMultilingualVoiceConfigForTests();
  });

  it("posts /audio/speech and returns MP3", async () => {
    const audio = new Uint8Array(48).fill(9);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(String(url)).toContain("/audio/speech");
        const body = JSON.parse(String(init?.body)) as { voice: string; model: string };
        expect(body.voice).toBe("nova");
        expect(body.model).toBe("tts-1");
        return new Response(audio, { status: 200 });
      }),
    );
    const utter = await openaiTtsSynthesize({
      cfg: cfg(),
      request: { text: "Hello", languageBcp: "es-US", preferredGender: "FEMALE" },
    });
    expect(utter.voiceName).toBe("nova");
    expect(utter.mimeType).toBe("audio/mpeg");
    expect(utter.audioContent.byteLength).toBe(48);
  });

  it("uses echo for male preference", async () => {
    const audio = new Uint8Array(48).fill(2);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { voice: string };
        expect(body.voice).toBe("echo");
        return new Response(audio, { status: 200 });
      }),
    );
    await openaiTtsSynthesize({
      cfg: cfg(),
      request: { text: "Hi", languageBcp: "en", preferredGender: "MALE" },
    });
  });
});
