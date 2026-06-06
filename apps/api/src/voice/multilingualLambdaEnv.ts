import { validateMultilingualDeploymentConfig } from "./multilingualConfig.js";

export type MultilingualConfigBlock = {
  code: "MULTILINGUAL_CONFIG_INVALID";
  issues: string[];
};

/**
 * Fail-fast for voice-related Lambdas when strict validation is enabled (see MULTILINGUAL_STRICT_VALIDATION).
 * Returns a structured payload for HTTP 503, or null when configuration is acceptable.
 */
export function getMultilingualConfigBlockResponse(): MultilingualConfigBlock | null {
  const issues = validateMultilingualDeploymentConfig();
  if (!issues.length) return null;
  return { code: "MULTILINGUAL_CONFIG_INVALID", issues };
}
