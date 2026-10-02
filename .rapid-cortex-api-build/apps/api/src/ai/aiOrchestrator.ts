import type { AiProviderAttemptRecord } from "rapid-cortex-shared";
import type { AnalysisInput } from "./provider.js";
import type { IAIProvider } from "./iaiProvider.js";
import type { AiRuntimeConfig } from "./aiConfig.js";
import { assertProductionAiConfigHealthy, getAiRuntimeConfig } from "./aiConfig.js";
import { buildAnalysisProviderChain, resolveAiSecrets } from "./aiProviderFactory.js";
import { parseAndValidateAnalysisOutput, type ValidatedAnalysisOutput } from "./analysisOutputSchema.js";
import { logAiProviderFailure } from "../lib/aiLog.js";
import { logAiMetric } from "../lib/aiMetrics.js";
import { AI_ERROR_CODES } from "./aiErrorCodes.js";
import { NormalizedAiError } from "./normalizedAiError.js";
import { classifyUnknownError, isRetryableForPolicy } from "./mapUnknownToAiError.js";
export type OrchestratorSuccess = {
  ok: true;
  output: ValidatedAnalysisOutput;
  winner: IAIProvider;
  attemptChain: AiProviderAttemptRecord[];
  totalLatencyMs: number;
  fallbackCount: number;
};

export type OrchestratorFailure = {
  ok: false;
  attemptChain: AiProviderAttemptRecord[];
  error: NormalizedAiError;
};

export type OrchestratorResult = OrchestratorSuccess | OrchestratorFailure;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const base = 400 * 2 ** attempt;
  const cap = 8000;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(cap, base + jitter);
}

async function analyzeWithTimeout(
  provider: IAIProvider,
  input: AnalysisInput,
  ms: number,
): Promise<unknown> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await provider.analyze(input, { signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Runs primary → secondary → tertiary with per-provider retries, timeouts, and shared Zod output validation.
 */
export async function runAiAnalysisOrchestrator(
  input: AnalysisInput,
  opts?: { config?: AiRuntimeConfig },
): Promise<OrchestratorResult> {
  const cfg = opts?.config ?? getAiRuntimeConfig();
  try {
    assertProductionAiConfigHealthy(cfg);
  } catch (e) {
    if (e instanceof NormalizedAiError) {
      return { ok: false, attemptChain: [], error: e };
    }
    throw e;
  }

  const secrets = await resolveAiSecrets(cfg);
  const chain = buildAnalysisProviderChain(cfg, secrets);

  if (chain.length === 0) {
    return {
      ok: false,
      attemptChain: [],
      error: new NormalizedAiError({
        code: AI_ERROR_CODES.AI_DISABLED,
        retryable: false,
        httpStatus: 503,
        publicMessage: "No AI providers are enabled for this deployment.",
      }),
    };
  }

  const attemptChain: AiProviderAttemptRecord[] = [];
  const started = Date.now();
  let lastError: NormalizedAiError | null = null;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i]!;
    if (i > 0) {
      logAiMetric({
        metric: "fallback_invoked",
        incidentId: input.incidentId,
        agencyId: input.agencyId,
        providerKind: provider.providerKind,
      });
    }
    const maxRetries = cfg.maxRetriesPerProvider;

    for (let r = 0; r <= maxRetries; r++) {
      const attemptStarted = Date.now();
      logAiMetric({
        metric: "provider_attempt_started",
        providerKind: provider.providerKind,
        adapterName: provider.adapterName,
        incidentId: input.incidentId,
        agencyId: input.agencyId,
      });
      try {
        const raw = await analyzeWithTimeout(provider, input, cfg.requestTimeoutMs);
        const parsed = parseAndValidateAnalysisOutput(raw);
        const latencyMs = Date.now() - attemptStarted;
        attemptChain.push({
          tierIndex: i,
          providerKind: provider.providerKind,
          adapterName: provider.adapterName,
          model: provider.model,
          outcome: "success",
          latencyMs,
        });
        logAiMetric({
          metric: "provider_attempt_succeeded",
          value: latencyMs,
          providerKind: provider.providerKind,
          adapterName: provider.adapterName,
          incidentId: input.incidentId,
          agencyId: input.agencyId,
        });
        const totalLatencyMs = Date.now() - started;
        const fallbackCount = Math.max(0, i);
        return {
          ok: true,
          output: parsed,
          winner: provider,
          attemptChain,
          totalLatencyMs,
          fallbackCount,
        };
      } catch (err) {
        const latencyMs = Date.now() - attemptStarted;
        const normalized = classifyUnknownError(err);
        attemptChain.push({
          tierIndex: i,
          providerKind: provider.providerKind,
          adapterName: provider.adapterName,
          model: provider.model,
          outcome: "failed",
          errorCode: normalized.code,
          latencyMs,
        });
        logAiProviderFailure(provider.adapterName, err);
        logAiMetric({
          metric: "provider_attempt_failed",
          providerKind: provider.providerKind,
          adapterName: provider.adapterName,
          errorCode: normalized.code,
          incidentId: input.incidentId,
          agencyId: input.agencyId,
        });
        lastError = normalized;

        const canRetry =
          r < maxRetries &&
          isRetryableForPolicy(err) &&
          normalized.code !== AI_ERROR_CODES.AI_SCHEMA_VALIDATION_FAILED &&
          normalized.code !== AI_ERROR_CODES.AI_INVALID_RESPONSE;

        if (canRetry) {
          await sleep(backoffMs(r));
          continue;
        }
        break;
      }
    }
  }

  logAiMetric({
    metric: "chain_all_failed",
    errorCode: lastError?.code,
    incidentId: input.incidentId,
    agencyId: input.agencyId,
  });

  return {
    ok: false,
    attemptChain,
    error:
      lastError ??
      new NormalizedAiError({
        code: AI_ERROR_CODES.AI_ALL_PROVIDERS_FAILED,
        retryable: false,
        httpStatus: 503,
        publicMessage: "All configured AI providers failed for this analysis request.",
      }),
  };
}
