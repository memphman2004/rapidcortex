import type { MultilingualProviderMode, SynthesizedUtterance, SynthesizeTextRequest } from "rapid-cortex-shared";
import {
  isSupportedCallLanguage,
  normalizeCallLanguageCode,
  toTranslatePrimaryTag,
} from "rapid-cortex-shared";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getMultilingualVoiceConfig, type MultilingualVoiceConfig } from "../../voice/multilingualConfig.js";
import { buildLanguageDetectorChain } from "../../voice/languageDetection/languageDetectorFactory.js";
import { runLanguageDetectionChain } from "../../voice/languageDetection/languageDetectionOrchestrator.js";
import {
  googleMultilingualDetectLanguage,
} from "./googleTranslateClient.js";
import { googleTextToSpeechSynthesize } from "../../voice/google/googleTextToSpeechRest.js";
import { getGoogleAccessToken } from "../../voice/google/googleAccessToken.js";
import { resolveGoogleServiceAccountCredentials } from "../../voice/google/googleCredentials.js";
import { VoiceProviderError } from "../../voice/providerErrors.js";
import { VOICE_ERROR_CODES } from "../../voice/voiceErrorCodes.js";
import { translateFromEnglishOrchestrated, translateToEnglishOrchestrated } from "./textTranslationOrchestrator.js";

export type TextTranslationBackend = "google" | "aws";

export function resolveLanguageProviderMode(cfg?: MultilingualVoiceConfig): MultilingualProviderMode {
  return (cfg ?? getMultilingualVoiceConfig()).languageProvider;
}

/**
 * Selects the backend for optional Google TTS (silent text) and detection chain selection.
 * Core text translate calls use {@link translateFromEnglish} / {@link translateToEnglish} with Azure→Google ordering.
 */
export function resolveTextTranslationBackend(cfg?: MultilingualVoiceConfig): TextTranslationBackend {
  const c = cfg ?? getMultilingualVoiceConfig();
  if (c.languageProvider === "google") return "google";
  if (c.languageProvider === "aws") return "aws";
  const hasGoogle =
    Boolean(c.googleCloudProjectId) &&
    Boolean(c.googleCredentialsSecretArn || c.googleApplicationCredentialsJson);
  return hasGoogle ? "google" : "aws";
}

export type NormalizedTextTranslation = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  provider: string;
};

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function translateToEnglish(
  text: string,
  sourceBcp: string,
  options?: { signal?: AbortSignal; requestId?: string; agencyId?: string; incidentId?: string },
): Promise<NormalizedTextTranslation> {
  const cfg = getMultilingualVoiceConfig();
  const src = toTranslatePrimaryTag(sourceBcp);
  if (!text.trim()) {
    throw new VoiceProviderError("Empty text", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, { retryable: false });
  }
  if (src === "en") {
    return { text: text.trim(), sourceLanguage: "en", targetLanguage: "en", confidence: 1, provider: "passthrough" };
  }
  if (!isSupportedCallLanguage(src, cfg.supportedLanguages)) {
    throw new VoiceProviderError("Unsupported source language for translation", VOICE_ERROR_CODES.UNSUPPORTED_LANGUAGE, {
      retryable: false,
    });
  }

  const r = await translateToEnglishOrchestrated(cfg, text, sourceBcp, options ?? {});
  return {
    text: r.text,
    sourceLanguage: r.sourceLanguage,
    targetLanguage: "en",
    confidence: r.confidence,
    provider: r.provider,
  };
}

/**
 * Assumes `text` is **English** dispatcher copy; translates to `targetBcp` (caller's language).
 */
export async function translateFromEnglish(
  text: string,
  targetBcp: string,
  options?: { signal?: AbortSignal; requestId?: string; agencyId?: string; incidentId?: string },
): Promise<NormalizedTextTranslation> {
  const cfg = getMultilingualVoiceConfig();
  const tgt = toTranslatePrimaryTag(targetBcp);
  if (!text.trim()) {
    throw new VoiceProviderError("Empty text", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, { retryable: false });
  }
  if (tgt === "en" || tgt === "und") {
    return { text: text.trim(), sourceLanguage: "en", targetLanguage: tgt, confidence: 1, provider: "passthrough" };
  }
  if (!isSupportedCallLanguage(tgt, cfg.supportedLanguages)) {
    throw new VoiceProviderError("Unsupported target language for translation", VOICE_ERROR_CODES.UNSUPPORTED_LANGUAGE, {
      retryable: false,
    });
  }

  const r = await translateFromEnglishOrchestrated(cfg, text, targetBcp, options ?? {});
  return {
    text: r.text,
    sourceLanguage: "en",
    targetLanguage: r.targetLanguage,
    confidence: r.confidence,
    provider: r.provider,
  };
}

export async function detectLanguage(
  text: string,
  options?: { signal?: AbortSignal },
): Promise<{ language: string; confidence: number; provider: string }> {
  const cfg = getMultilingualVoiceConfig();
  if (!text.trim()) {
    return { language: "und", confidence: 0, provider: "empty" };
  }
  const back = resolveTextTranslationBackend(cfg);
  if (back === "google") {
    const d = await googleMultilingualDetectLanguage(cfg, text, options?.signal);
    return { language: normalizeCallLanguageCode(d.language), confidence: d.confidence, provider: "google-detect" };
  }
  const detectors = buildLanguageDetectorChain(cfg);
  const lid = await runLanguageDetectionChain(detectors, text, {
    requestTimeoutMs: Math.min(cfg.providerRequestTimeoutMs, 25_000),
    maxRetries: cfg.providerMaxRetries,
  });
  return {
    language: normalizeCallLanguageCode(lid.language),
    confidence: lid.confidence,
    provider: lid.detectionMethod,
  };
}

/**
 * Synthesize with Google TTS. AWS Polly is not implemented; returns a clear error for `aws` text backend
 * if this is ever called without Google.
 */
export async function synthesizeTextWithConfiguredProvider(
  request: SynthesizeTextRequest,
  context: { agencyId: string; sessionId: string; messageId: string },
  options?: { signal?: AbortSignal },
): Promise<SynthesizedUtterance> {
  const cfg = getMultilingualVoiceConfig();
  if (!cfg.silentTextTtsEnabled) {
    throw new VoiceProviderError("TTS disabled (SILENT_TEXT_TTS_ENABLED)", VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
      retryable: false,
    });
  }
  const back = resolveTextTranslationBackend(cfg);
  if (back !== "google") {
    throw new VoiceProviderError(
      "Text-to-speech is only available when the text backend is Google. Set LANGUAGE_PROVIDER=google|auto with Google credentials, or add AWS Polly in a future release.",
      VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR,
      { retryable: false },
    );
  }
  const creds = await resolveGoogleServiceAccountCredentials(cfg);
  const accessToken = await getGoogleAccessToken(creds, ["https://www.googleapis.com/auth/cloud-platform"]);
  const utter = await googleTextToSpeechSynthesize({ accessToken, request, signal: options?.signal });
  const bucket = cfg.googleTtsOutputBucket || cfg.assetsBucket;
  if (!bucket) {
    return utter;
  }
  const key = `multilingual-tts/${context.agencyId}/${context.sessionId}/${context.messageId}.mp3`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(utter.audioContent),
      ContentType: utter.mimeType,
    }),
  );
  return { ...utter, storageObjectKey: key };
}
