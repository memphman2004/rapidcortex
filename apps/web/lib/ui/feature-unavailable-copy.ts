/**
 * Operator-facing copy when a feature or connection is unavailable.
 * Never expose env var names, API paths, or infra jargon in UI strings.
 */

export function featureNotEnabledMessage(featureLabel: string): string {
  return `${featureLabel} isn’t enabled for this agency. Contact Rapid Cortex support.`;
}

export function featureNotAvailableMessage(featureLabel: string): string {
  return `${featureLabel} isn’t available yet. Contact Rapid Cortex support.`;
}

export function apiNotConnectedMessage(context?: string): string {
  const suffix = context ? ` ${context}` : "";
  return `Platform connection isn’t configured.${suffix} Contact Rapid Cortex support.`;
}

export function mapNotConfiguredMessage(): string {
  return "Map isn’t configured for this environment. Contact Rapid Cortex support.";
}

export function trainingSampleDataMessage(): string {
  return "API isn’t connected — showing sample data only. Not for live operations.";
}
