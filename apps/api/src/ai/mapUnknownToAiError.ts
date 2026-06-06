import { AI_ERROR_CODES, type AiErrorCode } from "./aiErrorCodes.js";
import { NormalizedAiError } from "./normalizedAiError.js";
import { AnalysisOutputValidationError } from "./analysisOutputSchema.js";

function statusFromFetchLikeMessage(msg: string): number | null {
  const m = /\((\d{3})\)/.exec(msg);
  if (!m) return null;
  return Number.parseInt(m[1]!, 10);
}

export function classifyUnknownError(err: unknown): NormalizedAiError {
  if (err instanceof NormalizedAiError) return err;
  if (err instanceof AnalysisOutputValidationError) {
    const isJson = err.message.toLowerCase().includes("not valid json");
    return new NormalizedAiError({
      code: isJson ? AI_ERROR_CODES.AI_INVALID_RESPONSE : AI_ERROR_CODES.AI_SCHEMA_VALIDATION_FAILED,
      retryable: false,
      httpStatus: 422,
      publicMessage: isJson
        ? "Assistant output was not valid JSON."
        : "Assistant output did not match the required analysis format.",
      cause: err,
    });
  }
  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message.toLowerCase();
    if (name === "AbortError" || msg.includes("aborted")) {
      return new NormalizedAiError({
        code: AI_ERROR_CODES.AI_TIMEOUT,
        retryable: true,
        publicMessage: "The AI request timed out.",
        cause: err,
      });
    }
    if (msg.includes("fetch failed") || msg.includes("econnreset") || msg.includes("enotfound")) {
      return new NormalizedAiError({
        code: AI_ERROR_CODES.AI_NETWORK_ERROR,
        retryable: true,
        publicMessage: "A network error occurred while contacting the AI provider.",
        cause: err,
      });
    }
    const st = statusFromFetchLikeMessage(err.message);
    if (st === 401 || st === 403) {
      return new NormalizedAiError({
        code: AI_ERROR_CODES.AI_AUTH_ERROR,
        retryable: false,
        httpStatus: 503,
        publicMessage: "AI provider authentication failed.",
        cause: err,
      });
    }
    if (st === 429) {
      return new NormalizedAiError({
        code: AI_ERROR_CODES.AI_RATE_LIMIT,
        retryable: true,
        publicMessage: "AI provider rate limit reached.",
        cause: err,
      });
    }
    if (st !== null && st >= 500) {
      return new NormalizedAiError({
        code: AI_ERROR_CODES.AI_PROVIDER_5XX,
        retryable: true,
        publicMessage: "The AI provider returned a temporary error.",
        cause: err,
      });
    }
  }
  return new NormalizedAiError({
    code: AI_ERROR_CODES.AI_UNKNOWN_ERROR,
    retryable: false,
    publicMessage: "An unexpected error occurred during analysis.",
    cause: err,
  });
}

export function isRetryableForPolicy(err: unknown): boolean {
  if (err instanceof NormalizedAiError) return err.retryable;
  return classifyUnknownError(err).retryable;
}

export function errorCodeFromUnknown(err: unknown): AiErrorCode {
  return classifyUnknownError(err).code;
}
