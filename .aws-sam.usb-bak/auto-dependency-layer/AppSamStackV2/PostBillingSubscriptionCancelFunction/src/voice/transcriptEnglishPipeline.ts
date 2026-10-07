import type { TranscriptChunkInput } from "rapid-cortex-shared";
import { isSupportedCallLanguage, normalizeCallLanguageCode } from "rapid-cortex-shared";
import { getMultilingualVoiceConfig } from "./multilingualConfig.js";
import { buildLanguageDetectorChain } from "./languageDetection/languageDetectorFactory.js";
import { runLanguageDetectionChain } from "./languageDetection/languageDetectionOrchestrator.js";
import { buildTranslationProviderChain } from "./translation/translationProviderFactory.js";
import { runTranslationChain } from "./translation/translationOrchestrator.js";

export type EnglishPipelineResult = {
  englishText: string;
  originalTranscript?: string;
  originalLanguage?: string;
  languageConfidence?: number;
  languageAlternatives?: { language: string; confidence: number }[];
  translationConfidence?: number;
  translationProviderUsed?: string;
  translationModelUsed?: string;
  translationFallbackUsed?: boolean;
  translationLatencyMs?: number;
  needsInterpreterReview: boolean;
  lowConfidence: boolean;
  detectionMethod?: string;
};

export async function resolveEnglishTranscriptFromChunk(
  payload: TranscriptChunkInput,
  options?: { agencyId?: string },
): Promise<EnglishPipelineResult> {
  const cfg = getMultilingualVoiceConfig();
  const rawText = payload.text?.trim() ?? "";
  const rawOriginal = payload.originalTranscript?.trim() ?? "";

  if (!cfg.enableTranslationToEnglish) {
    const englishText = rawText || rawOriginal;
    return {
      englishText,
      originalTranscript: rawOriginal || undefined,
      originalLanguage: payload.originalLanguage,
      needsInterpreterReview: false,
      lowConfidence: false,
    };
  }

  if (!rawOriginal) {
    return {
      englishText: rawText,
      needsInterpreterReview: false,
      lowConfidence: false,
    };
  }

  let language = payload.originalLanguage?.split("-")[0]?.toLowerCase();
  let languageConfidence = 1;
  let detectionMethod: string | undefined = payload.originalLanguage ? "client_hint" : undefined;
  let languageAlternatives: { language: string; confidence: number }[] | undefined;

  if (!language) {
    const detectors = buildLanguageDetectorChain(cfg);
    const lid = await runLanguageDetectionChain(detectors, rawOriginal, {
      requestTimeoutMs: Math.min(cfg.providerRequestTimeoutMs, 25_000),
      maxRetries: cfg.providerMaxRetries,
    });
    language = normalizeCallLanguageCode(lid.language);
    languageConfidence = lid.confidence;
    detectionMethod = lid.detectionMethod;
    languageAlternatives = lid.alternatives;
  }

  const supported = isSupportedCallLanguage(language, cfg.supportedLanguages);
  const langLow = languageConfidence < cfg.languageDetectionMinConfidence;
  let englishText = rawText || rawOriginal;
  let translationConfidence = 1;
  let translationProviderUsed: string | undefined;
  let translationModelUsed: string | undefined;
  let translationFallbackUsed = false;
  let translationLatencyMs: number | undefined;

  if (!language || language === "und") {
    englishText = rawText || rawOriginal;
    translationConfidence = 0;
  } else if (language === "en") {
    englishText = rawOriginal;
    translationConfidence = 1;
  } else {
    const providers = buildTranslationProviderChain(cfg);
    const t0 = Date.now();
    const { result, providerName, tierIndex } = await runTranslationChain(
      providers,
      rawOriginal,
      language,
      {
        agencyId: options?.agencyId,
        requestTimeoutMs: cfg.providerRequestTimeoutMs,
        maxRetries: cfg.providerMaxRetries,
        enableFallbacks: cfg.providerEnableFallbacks,
      },
    );
    translationLatencyMs = Date.now() - t0;
    englishText = result.translated;
    translationConfidence = result.confidence;
    translationProviderUsed = providerName;
    translationFallbackUsed = tierIndex > 0;
    const models = [cfg.translationModelPrimary, cfg.translationModelSecondary, cfg.translationModelTertiary];
    translationModelUsed = models[tierIndex] ?? cfg.translationModelPrimary;
  }

  const trLow = translationConfidence < cfg.translationMinConfidence;
  const unsupported = !supported && language !== "en" && language !== "und";
  const needsInterpreterReview =
    Boolean(cfg.enableInterpreterEscalationFlag) &&
    (langLow || trLow || unsupported || language === "und");

  const lowConfidence =
    langLow || trLow || translationConfidence < cfg.translationMinConfidence;

  return {
    englishText,
    originalTranscript: rawOriginal,
    originalLanguage: language,
    languageConfidence,
    languageAlternatives,
    translationConfidence,
    translationProviderUsed,
    translationModelUsed,
    translationFallbackUsed,
    translationLatencyMs,
    needsInterpreterReview,
    lowConfidence,
    detectionMethod,
  };
}
