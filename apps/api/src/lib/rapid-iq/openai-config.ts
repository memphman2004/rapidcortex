import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";

/**
 * Load the OpenAI API key for RapidIQ.
 * Supports Secrets Manager plaintext keys or JSON `{ "OPENAI_API_KEY": "..." }` / `{ "apiKey": "..." }`.
 * Never log the returned value.
 */
export async function resolveRapidIqOpenAiKey(): Promise<string> {
  const arn =
    process.env.OPENAI_API_KEY_SECRET_ARN?.trim() ||
    process.env.RAPID_IQ_OPENAI_SECRET_ARN?.trim() ||
    "";
  const preferred =
    process.env.OPENAI_API_KEY_SECRET_FIELD?.trim() || "OPENAI_API_KEY";
  return resolvePlainOrSecretArn(process.env.OPENAI_API_KEY, arn || undefined, {
    preferredField: preferred,
  });
}

export function isRapidIqAiEnabled(): boolean {
  const alias = process.env.RAPIDIQ_AI_ENABLED?.trim();
  if (alias) {
    const v = alias.toLowerCase();
    return v !== "0" && v !== "false";
  }
  const raw = process.env.RAPID_IQ_AI_ENABLED?.trim()?.toLowerCase();
  if (raw === "0" || raw === "false") return false;
  return true;
}

export function isRapidIqWebSearchEnabled(): boolean {
  const raw = (
    process.env.OPENAI_WEB_SEARCH_ENABLED ??
    process.env.RAPID_IQ_WEB_SEARCH_ENABLED ??
    process.env.RAPIDIQ_WEB_SEARCH_ENABLED ??
    ""
  )
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true";
}

export function rapidIqModelClassification(): string {
  return (
    process.env.RAPIDIQ_MODEL_CLASSIFICATION?.trim() ||
    process.env.RAPID_IQ_MODEL_CLASSIFICATION?.trim() ||
    process.env.OPENAI_MODEL_PRIMARY?.trim() ||
    "gpt-4o-mini"
  );
}

export function rapidIqModelAnalysis(): string {
  return (
    process.env.RAPIDIQ_MODEL_ANALYSIS?.trim() ||
    process.env.RAPID_IQ_MODEL_ANALYSIS?.trim() ||
    process.env.OPENAI_MODEL_SECONDARY?.trim() ||
    process.env.OPENAI_MODEL_PRIMARY?.trim() ||
    "gpt-4o"
  );
}

export function rapidIqModelStrategy(): string {
  return (
    process.env.RAPIDIQ_MODEL_STRATEGY?.trim() ||
    process.env.RAPID_IQ_MODEL_STRATEGY?.trim() ||
    process.env.OPENAI_MODEL_TERTIARY?.trim() ||
    rapidIqModelAnalysis()
  );
}

export function rapidIqHighValueThreshold(): number {
  const n = Number.parseFloat(process.env.RAPID_IQ_INTEL_HIGH_VALUE_USD ?? "");
  return Number.isFinite(n) && n > 0 ? n : 250_000;
}
