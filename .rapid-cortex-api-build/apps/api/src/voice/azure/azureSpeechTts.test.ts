import { afterEach, describe, expect, it, vi } from "vitest";
import { azureSpeechSynthesize } from "./azureSpeechTts.js";
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
    azureSpeechKey: "test-speech-key",
    azureSpeechKeySecretArn: "",
    azureSpeechRegion: "eastus",
    azureSpeechEndpoint: "",
    openAiApiKey: "",
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

describe("azureSpeechSynthesize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetMultilingualVoiceConfigForTests();
  });

  it("posts SSML and returns MP3 bytes", async () => {
    const audio = new Uint8Array(64).fill(7);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(String(_url)).toContain("eastus.tts.speech.microsoft.com");
        expect(String(init?.body)).toContain("en-US-JennyNeural");
        expect(String(init?.body)).toContain("Hello");
        return new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg" } });
      }),
    );
    const utter = await azureSpeechSynthesize({
      cfg: cfg(),
      request: { text: "Hello", languageBcp: "en", preferredGender: "FEMALE" },
    });
    expect(utter.mimeType).toBe("audio/mpeg");
    expect(utter.voiceName).toBe("en-US-JennyNeural");
    expect(utter.audioContent.byteLength).toBe(64);
  });

  it("uses a signed Azure prosody rate", async () => {
    const audio = new Uint8Array(64).fill(1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(String(init?.body)).toContain('rate="+20%"');
        return new Response(audio, { status: 200 });
      }),
    );
    await azureSpeechSynthesize({
      cfg: cfg(),
      request: { text: "Hi", languageBcp: "en", speakingRate: 1.2 },
    });
  });

  it("throws on empty audio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array(8), { status: 200 })),
    );
    await expect(
      azureSpeechSynthesize({ cfg: cfg(), request: { text: "Hi", languageBcp: "en" } }),
    ).rejects.toThrow(/empty audio/);
  });
});
