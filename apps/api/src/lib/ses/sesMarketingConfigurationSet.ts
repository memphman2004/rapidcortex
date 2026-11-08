import { env } from "../env.js";

/**
 * SES configuration set for marketing / campaign mail (open/click/bounce/complaint).
 * Do not use for transactional billing mail — that stays on the transactional set.
 */
export function sesMarketingConfigurationSetFields(): { ConfigurationSetName?: string } {
  const explicit = process.env.SES_MARKETING_CONFIGURATION_SET_NAME?.trim();
  if (explicit) return { ConfigurationSetName: explicit };
  const stage =
    process.env.DEPLOYMENT_STAGE?.trim() ||
    process.env.STAGE?.trim() ||
    process.env.ENVIRONMENT?.trim() ||
    "";
  // Prompt canonical name; stage-suffixed fallback matches CFN when stage is set.
  if (stage && stage !== "prod" && stage !== "dev") {
    return { ConfigurationSetName: `nexcortiq-marketing-${stage}` };
  }
  // Live / default: exact name from the marketing email prompt.
  if (env.sesMarketingConfigurationSetName?.trim()) {
    return { ConfigurationSetName: env.sesMarketingConfigurationSetName.trim() };
  }
  return { ConfigurationSetName: "nexcortiq-marketing" };
}
