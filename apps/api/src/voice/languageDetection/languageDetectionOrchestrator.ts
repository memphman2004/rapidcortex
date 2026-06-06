import type { ILanguageDetector, LanguageDetectionResult } from "../interfaces.js";
import { logVoiceMetric } from "../voiceMetrics.js";
import { backoffWithJitterMs, isRetryableProviderError, sleepMs, withTimeout } from "../providerRuntime.js";

export type LanguageDetectionChainOptions = {
  signal?: AbortSignal;
  requestTimeoutMs?: number;
  maxRetries?: number;
};

export async function runLanguageDetectionChain(
  detectors: ILanguageDetector[],
  text: string,
  opts?: LanguageDetectionChainOptions,
): Promise<LanguageDetectionResult> {
  const requestTimeoutMs = opts?.requestTimeoutMs ?? 20_000;
  const maxRetries = opts?.maxRetries ?? 2;
  let last: LanguageDetectionResult | null = null;
  for (let i = 0; i < detectors.length; i++) {
    const d = detectors[i]!;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logVoiceMetric({ metric: "language_detect_attempt", detector: d.name, tier: i, attempt });
        const r = await withTimeout(
          d.detectFromText(text, { signal: opts?.signal }),
          requestTimeoutMs,
          "lang_detect",
          opts?.signal,
        );
        last = r;
        if (r.confidence >= 0.35 && r.language !== "und") {
          logVoiceMetric({
            metric: "language_detect_success",
            detector: d.name,
            language: r.language,
            confidence: r.confidence,
            tier: i,
          });
          return r;
        }
        break;
      } catch (e) {
        logVoiceMetric({ metric: "language_detect_failure", detector: d.name, tier: i, attempt });
        if (attempt < maxRetries && isRetryableProviderError(e)) {
          await sleepMs(backoffWithJitterMs(attempt, 200, 3000), opts?.signal);
          continue;
        }
        break;
      }
    }
  }
  return (
    last ?? {
      language: "und",
      confidence: 0,
      alternatives: [],
      detectionMethod: "mock",
    }
  );
}
