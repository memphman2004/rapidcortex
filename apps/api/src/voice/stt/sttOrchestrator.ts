import type { ISpeechToTextProvider, SttChunkResult } from "../interfaces.js";
import { assertProviderAllowedForAgency, inferProviderFromAdapterName } from "../../ai/providerPolicy.js";
import { logVoiceMetric } from "../voiceMetrics.js";
import { backoffWithJitterMs, isRetryableProviderError, sleepMs, withTimeout } from "../providerRuntime.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

export type SttChainOptions = {
  signal?: AbortSignal;
  agencyId?: string;
  requestTimeoutMs?: number;
  maxRetries?: number;
  enableFallbacks?: boolean;
};

export async function runSttChain(
  providers: ISpeechToTextProvider[],
  input: { audioBytes: Uint8Array; format: string; hintLanguage?: string },
  options?: SttChainOptions,
): Promise<{ result: SttChunkResult; providerName: string; tierIndex: number }> {
  const requestTimeoutMs = options?.requestTimeoutMs ?? 55_000;
  const maxRetries = options?.maxRetries ?? 2;
  const enableFallbacks = options?.enableFallbacks ?? true;
  const seedChain = enableFallbacks ? providers : providers.slice(0, 1);
  const chain: ISpeechToTextProvider[] = [];
  for (const provider of seedChain) {
    if (!options?.agencyId) {
      chain.push(provider);
      continue;
    }
    try {
      await assertProviderAllowedForAgency({
        agencyId: options.agencyId,
        provider: inferProviderFromAdapterName(provider.name),
        surface: "stt",
      });
      chain.push(provider);
    } catch (err) {
      logVoiceMetric({
        metric: "stt_policy_blocked",
        provider: provider.name,
        reason: err instanceof Error ? err.message : "policy_blocked",
      });
    }
  }
  if (chain.length === 0) {
    throw new VoiceProviderError(
      "No STT providers are allowed by agency policy",
      VOICE_ERROR_CODES.STT_ALL_PROVIDERS_FAILED,
      { retryable: false },
    );
  }
  let lastErr: unknown;
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i]!;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logVoiceMetric({ metric: "stt_attempt", provider: p.name, tier: i, attempt });
        const result = await withTimeout(
          p.transcribeAudioChunk(input, { signal: options?.signal }),
          requestTimeoutMs,
          "stt",
          options?.signal,
        );
        logVoiceMetric({
          metric: "stt_success",
          provider: p.name,
          language: result.languageCode,
          confidence: result.confidence,
          tier: i,
          attempt,
        });
        if (i > 0) {
          logVoiceMetric({
            metric: "stt_success_after_fallback",
            provider: p.name,
            tier: i,
            sttProviderLatencyMs: result.sttProviderLatencyMs,
          });
        }
        return { result, providerName: p.name, tierIndex: i };
      } catch (e) {
        lastErr = e;
        logVoiceMetric({ metric: "stt_failure", provider: p.name, tier: i, attempt });
        const willRetry = attempt < maxRetries && isRetryableProviderError(e);
        if (!willRetry && i + 1 < chain.length) {
          logVoiceMetric({ metric: "stt_fallback_next_tier", fromTier: i, toTier: i + 1, fromProvider: p.name });
        }
        if (willRetry) {
          await sleepMs(backoffWithJitterMs(attempt, 400, 5000), options?.signal);
          continue;
        }
        break;
      }
    }
  }
  throw new VoiceProviderError(
    lastErr instanceof Error ? lastErr.message : "All STT providers failed",
    VOICE_ERROR_CODES.STT_ALL_PROVIDERS_FAILED,
    { cause: lastErr, retryable: false },
  );
}
