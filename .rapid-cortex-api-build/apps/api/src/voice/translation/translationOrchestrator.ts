import type { ITranslationProvider, TranslationResult } from "../interfaces.js";
import { logVoiceMetric } from "../voiceMetrics.js";
import { backoffWithJitterMs, isRetryableProviderError, sleepMs, withTimeout } from "../providerRuntime.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

export type TranslationChainOptions = {
  signal?: AbortSignal;
  agencyId?: string;
  requestTimeoutMs?: number;
  maxRetries?: number;
  enableFallbacks?: boolean;
};

export async function runTranslationChain(
  providers: ITranslationProvider[],
  text: string,
  sourceLanguage: string,
  options?: TranslationChainOptions,
): Promise<{ result: TranslationResult; providerName: string; tierIndex: number }> {
  const requestTimeoutMs = options?.requestTimeoutMs ?? 45_000;
  const maxRetries = options?.maxRetries ?? 2;
  const enableFallbacks = options?.enableFallbacks ?? true;
  const chain = enableFallbacks ? providers : providers.slice(0, 1);
  let lastErr: unknown;
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i]!;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logVoiceMetric({ metric: "translation_attempt", provider: p.name, tier: i, attempt });
        const result = await withTimeout(
          p.translate(text, sourceLanguage, "en", {
            signal: options?.signal,
            ...(options?.agencyId ? { agencyId: options.agencyId } : {}),
          } as { signal?: AbortSignal }),
          requestTimeoutMs,
          "translation",
          options?.signal,
        );
        logVoiceMetric({
          metric: "translation_success",
          provider: p.name,
          sourceLanguage: result.sourceLanguage,
          tier: i,
          attempt,
        });
        return { result, providerName: p.name, tierIndex: i };
      } catch (e) {
        lastErr = e;
        logVoiceMetric({ metric: "translation_failure", provider: p.name, tier: i, attempt });
        if (attempt < maxRetries && isRetryableProviderError(e)) {
          await sleepMs(backoffWithJitterMs(attempt, 300, 4000), options?.signal);
          continue;
        }
        break;
      }
    }
  }
  throw new VoiceProviderError(
    lastErr instanceof Error ? lastErr.message : "All translation providers failed",
    VOICE_ERROR_CODES.TRANSLATION_ALL_PROVIDERS_FAILED,
    { cause: lastErr, retryable: false },
  );
}
