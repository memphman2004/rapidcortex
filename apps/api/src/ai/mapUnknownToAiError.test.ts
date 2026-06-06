import { describe, expect, it } from "vitest";
import { AI_ERROR_CODES } from "./aiErrorCodes.js";
import { classifyUnknownError, isRetryableForPolicy } from "./mapUnknownToAiError.js";
import { AnalysisOutputValidationError } from "./analysisOutputSchema.js";
import { NormalizedAiError } from "./normalizedAiError.js";

describe("classifyUnknownError", () => {
  it("classifies AbortError as timeout", () => {
    const e = new DOMException("Aborted", "AbortError");
    const n = classifyUnknownError(e);
    expect(n.code).toBe(AI_ERROR_CODES.AI_TIMEOUT);
    expect(n.retryable).toBe(true);
  });

  it("classifies invalid JSON validation as AI_INVALID_RESPONSE", () => {
    const e = new AnalysisOutputValidationError("Model output was not valid JSON", []);
    const n = classifyUnknownError(e);
    expect(n.code).toBe(AI_ERROR_CODES.AI_INVALID_RESPONSE);
  });

  it("passes through NormalizedAiError for isRetryableForPolicy", () => {
    const n = new NormalizedAiError({
      code: AI_ERROR_CODES.AI_RATE_LIMIT,
      retryable: true,
      publicMessage: "rl",
    });
    expect(isRetryableForPolicy(n)).toBe(true);
  });
});
