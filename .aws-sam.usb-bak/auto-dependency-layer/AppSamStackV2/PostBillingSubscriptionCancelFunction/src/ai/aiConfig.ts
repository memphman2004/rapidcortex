import { AI_ERROR_CODES } from "./aiErrorCodes.js";
import { NormalizedAiError } from "./normalizedAiError.js";

export type AiProviderKindName = "openai" | "anthropic" | "bedrock" | "mock" | "off";

function normalizeKind(v: string | undefined, fallback: AiProviderKindName): AiProviderKindName {
  const x = (v ?? fallback).trim().toLowerCase();
  if (x === "openai" || x === "anthropic" || x === "bedrock" || x === "mock" || x === "off") {
    return x;
  }
  return fallback;
}

function boolEnv(name: string, defaultValue: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return defaultValue;
}

function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export type AiRuntimeConfig = {
  deploymentStage: string;
  primaryProvider: AiProviderKindName;
  secondaryProvider: AiProviderKindName;
  tertiaryProvider: AiProviderKindName;
  enableFallbacks: boolean;
  storeProviderMetadata: boolean;
  promptVersion: string;
  requestTimeoutMs: number;
  maxRetriesPerProvider: number;
  analysisDebounceSeconds: number;
  maxAnalyzeRequestsPerIncidentPerHour: number;
  skipIfTranscriptUnchanged: boolean;
  analysisInFlightLeaseSeconds: number;
  openai: {
    baseUrl: string;
    modelPrimary: string;
    modelSecondary: string;
    modelTertiary: string;
    apiKeySecretArn: string;
  };
  anthropic: {
    baseUrl: string;
    modelPrimary: string;
    modelSecondary: string;
    modelTertiary: string;
    apiKeySecretArn: string;
  };
  bedrock: {
    region: string;
    modelPrimary: string;
    modelSecondary: string;
    modelTertiary: string;
  };
};

let cachedConfig: AiRuntimeConfig | null = null;

/** Legacy env: PRIMARY_PROVIDER, FALLBACK_PROVIDER, SECONDARY_FALLBACK_PROVIDER. */
export function getAiRuntimeConfig(): AiRuntimeConfig {
  if (cachedConfig) return cachedConfig;
  const secondaryFromLegacy =
    process.env.SECONDARY_PROVIDER?.trim() ||
    process.env.FALLBACK_PROVIDER?.trim() ||
    "mock";
  const tertiaryFromLegacy =
    process.env.TERTIARY_PROVIDER?.trim() ||
    process.env.SECONDARY_FALLBACK_PROVIDER?.trim() ||
    "off";

  const openaiModelPrimary =
    process.env.OPENAI_MODEL_PRIMARY?.trim() || "gpt-4o-mini";
  const openaiModelSecondary =
    process.env.OPENAI_MODEL_SECONDARY?.trim() ||
    process.env.OPENAI_MODEL_FALLBACK?.trim() ||
    openaiModelPrimary;
  const openaiModelTertiary =
    process.env.OPENAI_MODEL_TERTIARY?.trim() || openaiModelSecondary;

  const anthropicModelPrimary =
    process.env.ANTHROPIC_MODEL_PRIMARY?.trim() || "claude-3-5-haiku-20241022";
  const anthropicModelSecondary =
    process.env.ANTHROPIC_MODEL_SECONDARY?.trim() || anthropicModelPrimary;
  const anthropicModelTertiary =
    process.env.ANTHROPIC_MODEL_TERTIARY?.trim() || anthropicModelSecondary;

  const bedrockRegion =
    process.env.BEDROCK_REGION?.trim() || process.env.AWS_REGION?.trim() || "us-east-1";
  const bedrockModelPrimary =
    process.env.BEDROCK_MODEL_PRIMARY?.trim() || "anthropic.claude-3-5-haiku-20241022-v1:0";
  const bedrockModelSecondary =
    process.env.BEDROCK_MODEL_SECONDARY?.trim() || bedrockModelPrimary;
  const bedrockModelTertiary =
    process.env.BEDROCK_MODEL_TERTIARY?.trim() || bedrockModelSecondary;

  cachedConfig = {
    deploymentStage: process.env.DEPLOYMENT_STAGE?.trim() || "dev",
    primaryProvider: normalizeKind(process.env.PRIMARY_PROVIDER, "mock"),
    secondaryProvider: normalizeKind(secondaryFromLegacy, "mock"),
    tertiaryProvider: normalizeKind(tertiaryFromLegacy, "off"),
    enableFallbacks: boolEnv("AI_ENABLE_FALLBACKS", true),
    storeProviderMetadata: boolEnv("AI_STORE_PROVIDER_METADATA", true),
    promptVersion: process.env.AI_PROMPT_VERSION?.trim() || "dispatch-triage-v1",
    requestTimeoutMs: Math.max(5_000, intEnv("AI_REQUEST_TIMEOUT_MS", 55_000)),
    maxRetriesPerProvider: Math.max(0, Math.min(5, intEnv("AI_MAX_RETRIES_PER_PROVIDER", 1))),
    analysisDebounceSeconds: Math.max(0, intEnv("AI_ANALYSIS_DEBOUNCE_SECONDS", 0)),
    maxAnalyzeRequestsPerIncidentPerHour: Math.max(
      0,
      intEnv("AI_MAX_ANALYZE_REQUESTS_PER_INCIDENT_PER_HOUR", 120),
    ),
    skipIfTranscriptUnchanged: boolEnv("AI_SKIP_IF_TRANSCRIPT_UNCHANGED", true),
    analysisInFlightLeaseSeconds: Math.max(
      30,
      intEnv("AI_ANALYSIS_IN_FLIGHT_LEASE_SECONDS", 90),
    ),
    openai: {
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      modelPrimary: openaiModelPrimary,
      modelSecondary: openaiModelSecondary,
      modelTertiary: openaiModelTertiary,
      apiKeySecretArn: process.env.OPENAI_API_KEY_SECRET_ARN?.trim() ?? "",
    },
    anthropic: {
      baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com",
      modelPrimary: anthropicModelPrimary,
      modelSecondary: anthropicModelSecondary,
      modelTertiary: anthropicModelTertiary,
      apiKeySecretArn: process.env.ANTHROPIC_API_KEY_SECRET_ARN?.trim() ?? "",
    },
    bedrock: {
      region: bedrockRegion,
      modelPrimary: bedrockModelPrimary,
      modelSecondary: bedrockModelSecondary,
      modelTertiary: bedrockModelTertiary,
    },
  };
  return cachedConfig;
}

export function resetAiRuntimeConfigCacheForTests(): void {
  cachedConfig = null;
}

export function modelForTier(
  kind: AiProviderKindName,
  tierIndex: 0 | 1 | 2,
  cfg: AiRuntimeConfig,
): string {
  if (kind === "openai") {
    return tierIndex === 0
      ? cfg.openai.modelPrimary
      : tierIndex === 1
        ? cfg.openai.modelSecondary
        : cfg.openai.modelTertiary;
  }
  if (kind === "anthropic") {
    return tierIndex === 0
      ? cfg.anthropic.modelPrimary
      : tierIndex === 1
        ? cfg.anthropic.modelSecondary
        : cfg.anthropic.modelTertiary;
  }
  if (kind === "bedrock") {
    return tierIndex === 0
      ? cfg.bedrock.modelPrimary
      : tierIndex === 1
        ? cfg.bedrock.modelSecondary
        : cfg.bedrock.modelTertiary;
  }
  return "mock";
}

/**
 * Fail-fast checks for obviously broken production configuration (called before running analysis).
 */
export function assertProductionAiConfigHealthy(cfg: AiRuntimeConfig): void {
  const stage = cfg.deploymentStage.trim().toLowerCase();
  const requiresRealAi =
    stage === "prod" ||
    stage === "production" ||
    stage === "staging" ||
    stage === "pilot";
  if (!requiresRealAi) return;

  const chain: AiProviderKindName[] = cfg.enableFallbacks
    ? [cfg.primaryProvider, cfg.secondaryProvider, cfg.tertiaryProvider]
    : [cfg.primaryProvider];

  const real = chain.filter((k) => k !== "mock" && k !== "off");
  if (real.length === 0) {
    const allowMockOnly = process.env.AI_ALLOW_MOCK_ONLY_IN_PROD === "true";
    if (allowMockOnly) return;
    throw new NormalizedAiError({
      code: AI_ERROR_CODES.AI_CONFIG_ERROR,
      retryable: false,
      httpStatus: 503,
      publicMessage:
        "Staging/pilot/production AI is set to mock/off only. Set PRIMARY_PROVIDER (e.g. bedrock) and IAM/secrets, or set AI_ALLOW_MOCK_ONLY_IN_PROD=true for isolated sandboxes.",
    });
  }

  for (const k of real) {
    if (k === "openai") {
      const hasPlain = Boolean(process.env.OPENAI_API_KEY?.trim());
      const hasArn = Boolean(cfg.openai.apiKeySecretArn);
      if (!hasPlain && !hasArn) {
        throw new NormalizedAiError({
          code: AI_ERROR_CODES.AI_CONFIG_ERROR,
          retryable: false,
          httpStatus: 503,
          publicMessage: "Production requires OPENAI_API_KEY or OPENAI_API_KEY_SECRET_ARN when OpenAI is enabled.",
        });
      }
    }
    if (k === "anthropic") {
      const hasPlain = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
      const hasArn = Boolean(cfg.anthropic.apiKeySecretArn);
      if (!hasPlain && !hasArn) {
        throw new NormalizedAiError({
          code: AI_ERROR_CODES.AI_CONFIG_ERROR,
          retryable: false,
          httpStatus: 503,
          publicMessage:
            "Production requires ANTHROPIC_API_KEY or ANTHROPIC_API_KEY_SECRET_ARN when Anthropic is enabled.",
        });
      }
    }
  }
}
