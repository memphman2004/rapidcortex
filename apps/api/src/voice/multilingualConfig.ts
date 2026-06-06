import {
  parseMultilingualProviderMode,
  parseSupportedCallLanguagesEnv,
  type MultilingualProviderMode,
} from "rapid-cortex-shared";
import {
  AWS_TRANSCRIBE_MIN_IDENTIFY_LANGUAGE_OPTIONS,
  buildAwsTranscribeIdentifyLanguageOptions,
} from "./aws/transcribeLanguageMapping.js";

/**
 * Vendor tier for language detection, STT, and translation chains.
 * Legacy `aws_comprehend` / `aws_translate` env values normalize to `aws`.
 * `openai` is currently STT-only (Whisper / `gpt-4o-transcribe`); it is not
 * a valid choice for language detection or translation tiers.
 */
export type VoiceProviderKind = "azure" | "google" | "aws" | "openai" | "mock" | "off";

function normalizeVendorKind(v: string | undefined, d: VoiceProviderKind): VoiceProviderKind {
  const x = (v ?? d).trim().toLowerCase();
  if (
    x === "azure" ||
    x === "google" ||
    x === "aws" ||
    x === "openai" ||
    x === "mock" ||
    x === "off"
  ) {
    return x;
  }
  if (x === "aws_comprehend" || x === "aws_translate") return "aws";
  if (x === "openai-whisper" || x === "openai_whisper" || x === "whisper") return "openai";
  return d;
}

function boolEnv(n: string, def: boolean): boolean {
  const v = process.env[n]?.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return def;
}

function floatEnv(n: string, def: number): number {
  const x = Number.parseFloat(process.env[n] ?? "");
  return Number.isFinite(x) ? x : def;
}

function intEnv(n: string, def: number): number {
  const x = Number.parseInt(process.env[n] ?? "", 10);
  return Number.isFinite(x) ? x : def;
}

function strEnv(n: string, def = ""): string {
  return process.env[n]?.trim() ?? def;
}

export type MultilingualVoiceConfig = {
  supportedLanguages: Set<string>;
  languageDetectionMinConfidence: number;
  sttMinConfidence: number;
  translationMinConfidence: number;
  callStreamChunkMs: number;
  maxTranscriptReorderWindowMs: number;
  enableTranslationToEnglish: boolean;
  enableInterpreterEscalationFlag: boolean;
  autoFeedTranslatedTranscriptsToAnalysis: boolean;
  providerRequestTimeoutMs: number;
  providerMaxRetries: number;
  providerEnableFallbacks: boolean;
  primaryLanguageDetector: VoiceProviderKind;
  secondaryLanguageDetector: VoiceProviderKind;
  tertiaryLanguageDetector: VoiceProviderKind;
  primarySttProvider: VoiceProviderKind;
  secondarySttProvider: VoiceProviderKind;
  tertiarySttProvider: VoiceProviderKind;
  primaryTranslationProvider: VoiceProviderKind;
  secondaryTranslationProvider: VoiceProviderKind;
  tertiaryTranslationProvider: VoiceProviderKind;
  sttModelPrimary: string;
  sttModelSecondary: string;
  sttModelTertiary: string;
  translationModelPrimary: string;
  translationModelSecondary: string;
  translationModelTertiary: string;
  languageDetectModelPrimary: string;
  languageDetectModelSecondary: string;
  languageDetectModelTertiary: string;
  azureSpeechKey: string;
  azureSpeechKeySecretArn: string;
  azureSpeechRegion: string;
  azureSpeechEndpoint: string;
  /** OpenAI API key (used by Whisper STT). Prefer `openAiApiKeySecretArn` outside local dev. */
  openAiApiKey: string;
  openAiApiKeySecretArn: string;
  /** Override for OpenAI base URL (e.g. for tests or alternate gateways); empty = `https://api.openai.com/v1`. */
  openAiBaseUrl: string;
  /** Whisper / transcribe model id (e.g. `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`). */
  openAiWhisperModel: string;
  azureTranslatorKey: string;
  azureTranslatorKeySecretArn: string;
  azureTranslatorRegion: string;
  googleCloudProjectId: string;
  googleCredentialsSecretArn: string;
  googleApplicationCredentialsJson: string;
  awsTranscribeRegion: string;
  /** When true, chunks without a language hint use Transcribe `IdentifyLanguage` + `LanguageOptions` (max five). */
  awsTranscribeLanguageIdentification: boolean;
  /** Comma-separated BCP-47 codes used to build `LanguageOptions` (subset of up to five sent to AWS). */
  awsTranscribeLanguageOptionsCsv: string;
  /** Comma-separated preferred BCP-47 codes (ordering hint when trimming to five). */
  awsTranscribePreferredLanguageOptionsCsv: string;
  /** Poll budget for batch job completion (ms); 0 means use `providerRequestTimeoutMs`. */
  awsTranscribeTimeoutMs: number;
  /**
   * Documented no-op for the batch API: Transcribe jobs return **final** text only.
   * When true, emits a one-time metric noting partial streaming is unavailable.
   */
  awsTranscribeEnablePartialResults: boolean;
  awsTranslateRegion: string;
  awsComprehendRegion: string;
  assetsBucket: string;
  deploymentStage: string;
  /**
   * Text translation + optional TTS stack for silent text and similar flows (`aws` | `google` | `auto`).
   * Does not replace per-tier `PRIMARY_TRANSLATION_*` for the live voice / transcript chunk pipeline.
   */
  languageProvider: MultilingualProviderMode;
  googleTranslateLocation: string;
  googleTtsLocation: string;
  /** When empty, TTS output uses `assetsBucket`. */
  googleTtsOutputBucket: string;
  silentTextTranslationEnabled: boolean;
  silentTextTtsEnabled: boolean;
};

let cache: MultilingualVoiceConfig | null = null;

export function getMultilingualVoiceConfig(): MultilingualVoiceConfig {
  if (cache) return cache;
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  cache = {
    supportedLanguages: parseSupportedCallLanguagesEnv(process.env.SUPPORTED_CALL_LANGUAGES, {
      allowEnglishRemoval: boolEnv("ALLOW_ENGLISH_LANGUAGE_REMOVAL", false),
    }),
    languageDetectionMinConfidence: floatEnv("LANGUAGE_DETECTION_MIN_CONFIDENCE", 0.65),
    sttMinConfidence: floatEnv("STT_MIN_CONFIDENCE", 0.55),
    translationMinConfidence: floatEnv("TRANSLATION_MIN_CONFIDENCE", 0.6),
    callStreamChunkMs: Math.max(250, intEnv("CALL_STREAM_CHUNK_MS", 2000)),
    maxTranscriptReorderWindowMs: Math.max(0, intEnv("MAX_TRANSCRIPT_REORDER_WINDOW_MS", 30_000)),
    enableTranslationToEnglish: boolEnv("ENABLE_TRANSLATION_TO_ENGLISH", true),
    enableInterpreterEscalationFlag: boolEnv("ENABLE_INTERPRETER_ESCALATION_FLAG", true),
    autoFeedTranslatedTranscriptsToAnalysis: boolEnv(
      "AUTO_FEED_TRANSLATED_TRANSCRIPTS_TO_ANALYSIS",
      true,
    ),
    providerRequestTimeoutMs: Math.max(2000, intEnv("PROVIDER_REQUEST_TIMEOUT_MS", 55_000)),
    providerMaxRetries: Math.max(0, intEnv("PROVIDER_MAX_RETRIES", 2)),
    providerEnableFallbacks: boolEnv("PROVIDER_ENABLE_FALLBACKS", true),
    primaryLanguageDetector: normalizeVendorKind(process.env.PRIMARY_LANGUAGE_DETECTOR, "mock"),
    secondaryLanguageDetector: normalizeVendorKind(process.env.SECONDARY_LANGUAGE_DETECTOR, "mock"),
    tertiaryLanguageDetector: normalizeVendorKind(process.env.TERTIARY_LANGUAGE_DETECTOR, "off"),
    primarySttProvider: normalizeVendorKind(process.env.PRIMARY_STT_PROVIDER, "mock"),
    secondarySttProvider: normalizeVendorKind(process.env.SECONDARY_STT_PROVIDER, "mock"),
    tertiarySttProvider: normalizeVendorKind(process.env.TERTIARY_STT_PROVIDER, "off"),
    primaryTranslationProvider: normalizeVendorKind(process.env.PRIMARY_TRANSLATION_PROVIDER, "mock"),
    secondaryTranslationProvider: normalizeVendorKind(process.env.SECONDARY_TRANSLATION_PROVIDER, "mock"),
    tertiaryTranslationProvider: normalizeVendorKind(process.env.TERTIARY_TRANSLATION_PROVIDER, "off"),
    sttModelPrimary:
      strEnv("AZURE_SPEECH_STT_MODEL") ||
      strEnv("STT_MODEL_PRIMARY", "azure-stt-default"),
    sttModelSecondary:
      strEnv("OPENAI_WHISPER_MODEL") ||
      strEnv("GOOGLE_STT_MODEL") ||
      strEnv("STT_MODEL_SECONDARY", "openai-whisper-1"),
    sttModelTertiary: strEnv("AWS_TRANSCRIBE_MODEL") || strEnv("STT_MODEL_TERTIARY", "aws-transcribe-batch"),
    translationModelPrimary:
      strEnv("AZURE_TRANSLATION_MODEL") || strEnv("TRANSLATION_MODEL_PRIMARY", "azure-translator"),
    translationModelSecondary:
      strEnv("GOOGLE_TRANSLATION_MODEL") || strEnv("TRANSLATION_MODEL_SECONDARY", "google-translate-v2"),
    translationModelTertiary:
      strEnv("AWS_TRANSLATION_MODEL") || strEnv("TRANSLATION_MODEL_TERTIARY", "aws-translate"),
    languageDetectModelPrimary: strEnv("LANGUAGE_DETECT_MODEL_PRIMARY", "azure-translator-detect"),
    languageDetectModelSecondary: strEnv("LANGUAGE_DETECT_MODEL_SECONDARY", "google-translate-detect"),
    languageDetectModelTertiary: strEnv("LANGUAGE_DETECT_MODEL_TERTIARY", "aws-comprehend-detect"),
    azureSpeechKey: strEnv("AZURE_SPEECH_KEY"),
    azureSpeechKeySecretArn: strEnv("AZURE_SPEECH_KEY_SECRET_ARN"),
    azureSpeechRegion: strEnv("AZURE_SPEECH_REGION", "eastus"),
    azureSpeechEndpoint: strEnv("AZURE_SPEECH_ENDPOINT"),
    openAiApiKey: strEnv("OPENAI_API_KEY"),
    openAiApiKeySecretArn: strEnv("OPENAI_API_KEY_SECRET_ARN"),
    openAiBaseUrl: strEnv("OPENAI_BASE_URL"),
    openAiWhisperModel: strEnv("OPENAI_WHISPER_MODEL", "whisper-1"),
    azureTranslatorKey: strEnv("AZURE_TRANSLATION_KEY", strEnv("AZURE_SPEECH_KEY")),
    azureTranslatorKeySecretArn: strEnv(
      "AZURE_TRANSLATION_KEY_SECRET_ARN",
      strEnv("AZURE_SPEECH_KEY_SECRET_ARN"),
    ),
    azureTranslatorRegion: strEnv("AZURE_TRANSLATION_REGION", strEnv("AZURE_SPEECH_REGION", "eastus")),
    googleCloudProjectId: strEnv("GOOGLE_CLOUD_PROJECT_ID"),
    googleCredentialsSecretArn: strEnv("GOOGLE_APPLICATION_CREDENTIALS_SECRET_ARN"),
    googleApplicationCredentialsJson: strEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"),
    awsTranscribeRegion: strEnv("AWS_TRANSCRIBE_REGION", region),
    awsTranscribeLanguageIdentification: boolEnv("AWS_TRANSCRIBE_LANGUAGE_IDENTIFICATION", true),
    awsTranscribeLanguageOptionsCsv: strEnv("AWS_TRANSCRIBE_LANGUAGE_OPTIONS", ""),
    awsTranscribePreferredLanguageOptionsCsv: strEnv("AWS_TRANSCRIBE_PREFERRED_LANGUAGE_OPTIONS", ""),
    awsTranscribeTimeoutMs: Math.max(0, intEnv("AWS_TRANSCRIBE_TIMEOUT_MS", 0)),
    awsTranscribeEnablePartialResults: boolEnv("AWS_TRANSCRIBE_ENABLE_PARTIAL_RESULTS", false),
    awsTranslateRegion: strEnv("AWS_TRANSLATE_REGION", region),
    awsComprehendRegion: strEnv("AWS_COMPREHEND_REGION", region),
    assetsBucket: strEnv("ASSETS_BUCKET"),
    deploymentStage: strEnv("DEPLOYMENT_STAGE", "dev"),
    languageProvider: parseMultilingualProviderMode(process.env.LANGUAGE_PROVIDER, "auto"),
    googleTranslateLocation: strEnv("GOOGLE_TRANSLATE_LOCATION", "global"),
    googleTtsLocation: strEnv("GOOGLE_TTS_LOCATION", "global"),
    googleTtsOutputBucket: strEnv("GOOGLE_TTS_OUTPUT_BUCKET"),
    silentTextTranslationEnabled: boolEnv("SILENT_TEXT_TRANSLATION_ENABLED", true),
    silentTextTtsEnabled: boolEnv("SILENT_TEXT_TTS_ENABLED", false),
  };
  return cache;
}

export function resetMultilingualVoiceConfigForTests(): void {
  cache = null;
}

/**
 * When true, `validateMultilingualDeploymentConfig` enforces credential presence for any
 * selected non-mock multilingual tier. Set explicitly, or defaults to strict for staging/prod.
 */
export function isMultilingualStrictValidationEnabled(): boolean {
  const v = process.env.MULTILINGUAL_STRICT_VALIDATION?.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  const stage = process.env.DEPLOYMENT_STAGE?.trim().toLowerCase() ?? "";
  return stage === "prod" || stage === "staging" || stage === "pilot";
}

/**
 * Validates multilingual env for this Lambda when strict mode is on (staging/prod by default).
 * Call from handlers or ops checks; does not throw.
 */
export function validateMultilingualDeploymentConfig(): string[] {
  if (!isMultilingualStrictValidationEnabled()) return [];
  const cfg = getMultilingualVoiceConfig();
  const issues: string[] = [];
  const needsAzureSpeech =
    cfg.primarySttProvider === "azure" ||
    cfg.secondarySttProvider === "azure" ||
    cfg.tertiarySttProvider === "azure" ||
    cfg.primaryLanguageDetector === "azure" ||
    cfg.primaryTranslationProvider === "azure";
  if (needsAzureSpeech && !cfg.azureSpeechKey && !cfg.azureSpeechKeySecretArn) {
    issues.push("Azure Speech is selected but AZURE_SPEECH_KEY and AZURE_SPEECH_KEY_SECRET_ARN are empty.");
  }
  const needsAzureTr =
    cfg.primaryTranslationProvider === "azure" ||
    cfg.secondaryTranslationProvider === "azure" ||
    cfg.tertiaryTranslationProvider === "azure" ||
    cfg.primaryLanguageDetector === "azure";
  if (needsAzureTr && !cfg.azureTranslatorKey && !cfg.azureTranslatorKeySecretArn) {
    issues.push("Azure Translator is selected but AZURE_TRANSLATION_KEY / secret ARN are empty.");
  }
  const needsGoogle =
    cfg.primarySttProvider === "google" ||
    cfg.secondarySttProvider === "google" ||
    cfg.tertiarySttProvider === "google" ||
    cfg.primaryLanguageDetector === "google" ||
    cfg.primaryTranslationProvider === "google";
  if (needsGoogle && !cfg.googleCloudProjectId) {
    issues.push("Google Cloud is selected but GOOGLE_CLOUD_PROJECT_ID is empty.");
  }
  if (needsGoogle && !cfg.googleCredentialsSecretArn && !cfg.googleApplicationCredentialsJson) {
    issues.push(
      "Google Cloud is selected but neither GOOGLE_APPLICATION_CREDENTIALS_SECRET_ARN nor GOOGLE_APPLICATION_CREDENTIALS_JSON is set.",
    );
  }
  if (cfg.languageProvider === "google" && !cfg.googleCloudProjectId) {
    issues.push("LANGUAGE_PROVIDER=google but GOOGLE_CLOUD_PROJECT_ID is empty.");
  }
  if (
    cfg.languageProvider === "google" &&
    !cfg.googleCredentialsSecretArn &&
    !cfg.googleApplicationCredentialsJson
  ) {
    issues.push("LANGUAGE_PROVIDER=google but Google service account secret / JSON is not set.");
  }
  const needsOpenAiWhisper =
    cfg.primarySttProvider === "openai" ||
    cfg.secondarySttProvider === "openai" ||
    cfg.tertiarySttProvider === "openai";
  if (needsOpenAiWhisper && !cfg.openAiApiKey && !cfg.openAiApiKeySecretArn) {
    issues.push(
      "OpenAI Whisper STT is selected but neither OPENAI_API_KEY nor OPENAI_API_KEY_SECRET_ARN is set.",
    );
  }
  if (
    cfg.primaryLanguageDetector === ("openai" as VoiceProviderKind) ||
    cfg.secondaryLanguageDetector === ("openai" as VoiceProviderKind) ||
    cfg.tertiaryLanguageDetector === ("openai" as VoiceProviderKind) ||
    cfg.primaryTranslationProvider === ("openai" as VoiceProviderKind) ||
    cfg.secondaryTranslationProvider === ("openai" as VoiceProviderKind) ||
    cfg.tertiaryTranslationProvider === ("openai" as VoiceProviderKind)
  ) {
    issues.push("`openai` is only valid for STT tiers; remove it from language detection or translation chains.");
  }
  const needsAwsTranscribe =
    cfg.primarySttProvider === "aws" || cfg.secondarySttProvider === "aws" || cfg.tertiarySttProvider === "aws";
  if (needsAwsTranscribe && !cfg.assetsBucket) {
    issues.push("AWS Transcribe is selected but ASSETS_BUCKET is empty (required for batch media staging).");
  }
  if (needsAwsTranscribe && cfg.awsTranscribeLanguageIdentification) {
    const opts = buildAwsTranscribeIdentifyLanguageOptions(
      cfg.awsTranscribeLanguageOptionsCsv,
      cfg.awsTranscribePreferredLanguageOptionsCsv,
    );
    if (opts.length < AWS_TRANSCRIBE_MIN_IDENTIFY_LANGUAGE_OPTIONS) {
      issues.push(
        `AWS Transcribe IdentifyLanguage needs at least ${AWS_TRANSCRIBE_MIN_IDENTIFY_LANGUAGE_OPTIONS} entries in AWS_TRANSCRIBE_LANGUAGE_OPTIONS (after merge with preferred list); got ${opts.length}.`,
      );
    }
  }
  if (needsAwsTranscribe && cfg.awsTranscribeTimeoutMs > 0 && cfg.awsTranscribeTimeoutMs < 5000) {
    issues.push("AWS_TRANSCRIBE_TIMEOUT_MS must be 0 (use provider default) or at least 5000ms.");
  }
  return issues;
}

/**
 * @deprecated Use {@link validateMultilingualDeploymentConfig} (same behavior; name kept for imports).
 */
export function validateMultilingualProductionConfig(): string[] {
  return validateMultilingualDeploymentConfig();
}
