export const CALL_ASSIST_LOCALES = ["en_US", "es_US", "zh_CN", "fr_CA"] as const;
export type CallAssistLocale = (typeof CALL_ASSIST_LOCALES)[number];

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
