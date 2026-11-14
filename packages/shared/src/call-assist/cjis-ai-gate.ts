/**
 * CJIS AI gate for Call Assist content processing (QA / summarization).
 *
 * Nova Sonic / Lex voice paths are operational tools and are NOT gated here.
 * Unset flags preserve live behavior (Bedrock QA remains allowed when model env is set).
 * Explicit `cjisAiAuthorized: false` or `callQualityScoringEnabled: false` blocks content Bedrock.
 */

export type CallAssistCjisAiGateConfig = {
  cjisAiAuthorized?: boolean | null;
  callQualityScoringEnabled?: boolean | null;
};

/** Unset = authorized (preserve existing tenants). Explicit false blocks. */
export function isCallAssistCjisAiAuthorized(config?: CallAssistCjisAiGateConfig | null): boolean {
  return config?.cjisAiAuthorized !== false;
}

/** Unset = enabled (preserve existing tenants). Explicit false blocks. */
export function isCallAssistCallQualityScoringEnabled(
  config?: CallAssistCjisAiGateConfig | null,
): boolean {
  return config?.callQualityScoringEnabled !== false;
}

/** Dual gate required before sending call transcript/content to Bedrock. */
export function canScoreCallAssistContentWithBedrock(
  config?: CallAssistCjisAiGateConfig | null,
): boolean {
  return isCallAssistCjisAiAuthorized(config) && isCallAssistCallQualityScoringEnabled(config);
}
