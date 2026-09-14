export const CALL_ASSIST_LOCALES = [
  "en_US",
  "es_US",
  "zh_CN",
  "zh_HK",
  "tl_PH",
  "vi_VN",
  "ar_AE",
  "fr_CA",
] as const;
export type CallAssistLocale = (typeof CALL_ASSIST_LOCALES)[number];

/** Agencies may enable English + Spanish plus the 911 language pack. */
export const MAX_CALL_ASSIST_LOCALES = 8;

/**
 * Lex V2 locale metadata. Tagalog and Vietnamese are limited-ASR locales
 * (AWS asterisk — generative AI / third-party ASR-TTS) but valid in us-east-1.
 * fr_CA remains typed for existing configs; it is not in the 911 language pack yet.
 */
export const CALL_ASSIST_LOCALE_META: Record<
  CallAssistLocale,
  {
    label: string;
    bcp47: string;
    voiceId: string;
    engine: "neural" | "standard" | "generative";
    limitedAsr: boolean;
    callLanguage: "en" | "es" | "zh" | "yue" | "tl" | "vi" | "ar" | "fr";
  }
> = {
  en_US: { label: "English (US)", bcp47: "en-US", voiceId: "Ruth", engine: "neural", limitedAsr: false, callLanguage: "en" },
  es_US: { label: "Spanish (US)", bcp47: "es-US", voiceId: "Lupe", engine: "neural", limitedAsr: false, callLanguage: "es" },
  zh_CN: { label: "Mandarin (Chinese)", bcp47: "zh-CN", voiceId: "Zhiyu", engine: "neural", limitedAsr: false, callLanguage: "zh" },
  zh_HK: { label: "Cantonese (Hong Kong)", bcp47: "zh-HK", voiceId: "Hiujin", engine: "neural", limitedAsr: false, callLanguage: "yue" },
  tl_PH: { label: "Tagalog / Filipino", bcp47: "tl-PH", voiceId: "Ruth", engine: "neural", limitedAsr: true, callLanguage: "tl" },
  vi_VN: { label: "Vietnamese", bcp47: "vi-VN", voiceId: "Linh", engine: "neural", limitedAsr: true, callLanguage: "vi" },
  ar_AE: { label: "Arabic (Gulf)", bcp47: "ar-AE", voiceId: "Hala", engine: "neural", limitedAsr: false, callLanguage: "ar" },
  fr_CA: { label: "French (Canada)", bcp47: "fr-CA", voiceId: "Gabrielle", engine: "neural", limitedAsr: false, callLanguage: "fr" },
};

export const CALL_ASSIST_911_LANGUAGE_PACK: CallAssistLocale[] = [
  "zh_CN",
  "zh_HK",
  "tl_PH",
  "vi_VN",
  "ar_AE",
];

export const LEX_BOT_STATUSES = [
  "NOT_CREATED",
  "CREATING",
  "BUILD_PENDING",
  "BUILDING",
  "BUILT",
  "FAILED",
  "UPDATE_PENDING",
  "UPDATING",
] as const;
export type LexBotStatus = (typeof LEX_BOT_STATUSES)[number];

export const CALL_ASSIST_ONBOARDING_STATUSES = [
  "PENDING",
  "BOT_CREATING",
  "BOT_BUILDING",
  "FLOW_CREATING",
  "VOCAB_UPLOADING",
  "DID_PENDING",
  "SMOKE_TEST_PENDING",
  "ACTIVE",
  "FAILED",
] as const;
export type CallAssistOnboardingStatus = (typeof CALL_ASSIST_ONBOARDING_STATUSES)[number];

export const ONBOARDING_STEP_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETE", "FAILED"] as const;
export type OnboardingStepStatus = (typeof ONBOARDING_STEP_STATUSES)[number];

export type OnboardingStepRecord = {
  step: string;
  status: OnboardingStepStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type LexBotRecord = {
  agencyId: string;
  locale: CallAssistLocale;
  botId: string;
  botName: string;
  botAliasId: string;
  botAliasName: string;
  botVersion: string;
  templateVersion: string;
  status: LexBotStatus;
  buildStartedAt?: string;
  buildCompletedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export const BOT_REBUILD_REASONS = ["TEMPLATE_UPDATE", "LOCALE_ADDED", "VOCAB_UPDATED", "MANUAL"] as const;
export type BotRebuildReason = (typeof BOT_REBUILD_REASONS)[number];

export const BOT_REBUILD_STATUSES = ["QUEUED", "IN_PROGRESS", "COMPLETE", "FAILED"] as const;
export type BotRebuildStatus = (typeof BOT_REBUILD_STATUSES)[number];

export type BotRebuildQueueEntry = {
  agencyId: string;
  queuedAt: string;
  targetTemplateVersion: string;
  reason: BotRebuildReason;
  status: BotRebuildStatus;
  processedAt?: string;
  attempts: number;
  lastError?: string;
};

export type CallAssistOnboardingInput = {
  agencyId: string;
  agencyDisplayName: string;
  agencyShortName: string;
  agencyTypeLabel: string;
  officerLabel: string;
  nonEmergencyWebsite?: string;
  onlineReportPortalUrl?: string;
  carfaxPortalUrl?: string;
  supportedLocales: CallAssistLocale[];
  aiDisclosureRequired: boolean;
  customVocabularyPhrases?: string[];
  createdBy: string;
};

export const LEX_BOT_QUOTA_CODE = "L-C38B0AF9";
export const LEX_BOT_QUOTA_HEADROOM = 5;
export const LEX_BOT_BUILD_TIMEOUT_MS = 300_000;
export const LEX_BOT_BUILD_POLL_MS = 10_000;
export const LEX_DEFAULT_BOT_QUOTA = 100;
export const LEX_BOT_QUOTA_CONSOLE_URL =
  "https://console.aws.amazon.com/servicequotas/home/dev_bravo/services/lex/quotas/L-C38B0AF9";

const REBUILD_IN_FLIGHT = new Set([
  "CREATING",
  "BUILD_PENDING",
  "BUILDING",
  "UPDATE_PENDING",
  "UPDATING",
]);

export function isLexBotQuotaBlocking(currentBotCount: number, limit: number): boolean {
  return currentBotCount >= limit - LEX_BOT_QUOTA_HEADROOM;
}

/** Rolling rebuild is one bot per 5-minute window; old aliases keep serving until switched. */
export function estimatedLexBotRebuildMinutes(pendingBotCount: number): number {
  return Math.max(0, pendingBotCount) * (LEX_BOT_BUILD_TIMEOUT_MS / 60_000);
}

export function callAssistBotNeedsRebuild(bot: {
  status?: string | null;
  current?: boolean;
}): boolean {
  const status = bot.status ?? "NOT_CREATED";
  if (status === "NOT_CREATED") return false;
  if (REBUILD_IN_FLIGHT.has(status)) return true;
  return bot.current === false;
}
