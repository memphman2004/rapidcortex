import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { StartTranscriptionJobCommand, type TranscribeClient } from "@aws-sdk/client-transcribe";
import type { S3Client } from "@aws-sdk/client-s3";
import { AwsTranscribeSttProvider } from "./awsTranscribeSttProvider.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { resetMultilingualVoiceConfigForTests } from "../multilingualConfig.js";

function baseCfg(over: Partial<MultilingualVoiceConfig> = {}): MultilingualVoiceConfig {
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
    primaryLanguageDetector: "mock",
    secondaryLanguageDetector: "mock",
    tertiaryLanguageDetector: "off",
    primarySttProvider: "aws",
    secondarySttProvider: "mock",
    tertiarySttProvider: "off",
    primaryTranslationProvider: "mock",
    secondaryTranslationProvider: "mock",
    tertiaryTranslationProvider: "off",
    sttModelPrimary: "aws-transcribe-batch",
    sttModelSecondary: "x",
    sttModelTertiary: "x",
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
    azureTranslatorKey: "",
    azureTranslatorKeySecretArn: "",
    azureTranslatorRegion: "eastus",
    googleCloudProjectId: "",
    googleCredentialsSecretArn: "",
    googleApplicationCredentialsJson: "",
    awsTranscribeRegion: "us-east-1",
    awsTranscribeLanguageIdentification: true,
    awsTranscribeLanguageOptionsCsv: "en-US,es-US,zh-CN,tl-PH,vi-VN",
    awsTranscribePreferredLanguageOptionsCsv: "",
    awsTranscribeTimeoutMs: 90_000,
    awsTranscribeEnablePartialResults: false,
    awsTranslateRegion: "us-east-1",
    awsComprehendRegion: "us-east-1",
    assetsBucket: "bukkit",
    deploymentStage: "dev",
    ...over,
  };
}

describe("AwsTranscribeSttProvider", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: {
            transcripts: [{ transcript: "hello world" }],
            language_code: "en-US",
            language_identification: [{ code: "en-US", score: 0.91 }],
          },
        }),
      })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMultilingualVoiceConfigForTests();
  });

  it("returns normalized SttChunkResult on completed job", async () => {
    const transcribeSend = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValue({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: { TranscriptFileUri: "https://example/transcribe-output.json" },
        },
      });
    const s3Send = vi.fn().mockResolvedValue({});

    const p = new AwsTranscribeSttProvider(baseCfg(), {
      sttModelUsed: "aws-transcribe-batch",
      transcribeClient: { send: transcribeSend } as unknown as TranscribeClient,
      s3Client: { send: s3Send } as unknown as S3Client,
    });

    const out = await p.transcribeAudioChunk(
      { audioBytes: new Uint8Array([1, 2, 3, 4]), format: "pcm16le" },
      {},
    );
    expect(out.transcript).toBe("hello world");
    expect(out.languageCode).toBe("en");
    expect(out.confidence).toBeCloseTo(0.91, 5);
    expect(out.isPartial).toBe(false);
    expect(out.sttModelUsed).toBe("aws-transcribe-batch");
    expect(out.providerRequestId).toMatch(/^rcstt/);
    expect(typeof out.sttProviderLatencyMs).toBe("number");
    expect(transcribeSend).toHaveBeenCalled();
    expect(s3Send).toHaveBeenCalled();
  });

  it("uses fixed LanguageCode when hint is present", async () => {
    const transcribeSend = vi.fn().mockResolvedValueOnce({}).mockResolvedValue({
      TranscriptionJob: {
        TranscriptionJobStatus: "COMPLETED",
        Transcript: { TranscriptFileUri: "https://example/out.json" },
      },
    });
    const p = new AwsTranscribeSttProvider(baseCfg({ awsTranscribeLanguageIdentification: true }), {
      transcribeClient: { send: transcribeSend } as unknown as TranscribeClient,
      s3Client: { send: vi.fn().mockResolvedValue({}) } as unknown as S3Client,
    });
    await p.transcribeAudioChunk(
      { audioBytes: new Uint8Array([1, 2]), format: "pcm16le", hintLanguage: "es" },
      {},
    );
    const startCmd = transcribeSend.mock.calls[0]![0] as StartTranscriptionJobCommand;
    expect(startCmd.input.LanguageCode).toBe("es-US");
    expect(startCmd.input.IdentifyLanguage).toBeUndefined();
  });
});
