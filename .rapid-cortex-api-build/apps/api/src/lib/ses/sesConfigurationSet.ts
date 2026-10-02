import { env } from "../env.js";

/** Attach SES configuration set when configured (bounce/complaint event routing). */
export function sesConfigurationSetFields(): { ConfigurationSetName?: string } {
  const name = env.sesConfigurationSetName?.trim();
  return name ? { ConfigurationSetName: name } : {};
}
