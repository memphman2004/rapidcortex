import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

function readSdkErr(err: unknown): { name?: string; message?: string; status?: number } {
  if (!err || typeof err !== "object") return {};
  const o = err as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name : undefined;
  const message = typeof o.message === "string" ? o.message : undefined;
  const meta = o.$metadata as { httpStatusCode?: number } | undefined;
  const status = typeof meta?.httpStatusCode === "number" ? meta.httpStatusCode : undefined;
  return { name, message, status };
}

/**
 * Map `@aws-sdk/client-transcribe` (and shared AWS SDK) errors to {@link VoiceProviderError}.
 */
export function voiceErrorFromTranscribeSdk(err: unknown): VoiceProviderError {
  const { name, message, status } = readSdkErr(err);
  const text = message ?? (err instanceof Error ? err.message : "Transcribe SDK error");

  if (name === "ThrottlingException" || name === "TooManyRequestsException") {
    return new VoiceProviderError(text, VOICE_ERROR_CODES.STT_RATE_LIMIT, { cause: err, retryable: true });
  }
  if (name === "AccessDeniedException" || name === "UnauthorizedException") {
    return new VoiceProviderError(text, VOICE_ERROR_CODES.STT_AUTH_ERROR, { cause: err, httpStatus: status, retryable: false });
  }
  if (name === "BadRequestException" || name === "ValidationException") {
    return new VoiceProviderError(text, VOICE_ERROR_CODES.STT_INVALID_RESPONSE, { cause: err, httpStatus: status, retryable: false });
  }
  if (typeof status === "number") {
    if (status === 401 || status === 403) {
      return new VoiceProviderError(text, VOICE_ERROR_CODES.STT_AUTH_ERROR, { cause: err, httpStatus: status, retryable: false });
    }
    if (status === 429) {
      return new VoiceProviderError(text, VOICE_ERROR_CODES.STT_RATE_LIMIT, { cause: err, httpStatus: status, retryable: true });
    }
    if (status >= 500) {
      return new VoiceProviderError(text, VOICE_ERROR_CODES.STT_PROVIDER_5XX, { cause: err, httpStatus: status, retryable: true });
    }
  }
  if (
    name === "InternalServerException" ||
    name === "ServiceUnavailableException" ||
    name === "LimitExceededException"
  ) {
    return new VoiceProviderError(text, VOICE_ERROR_CODES.STT_PROVIDER_5XX, { cause: err, httpStatus: status, retryable: true });
  }

  return new VoiceProviderError(text, VOICE_ERROR_CODES.UNKNOWN_PROVIDER_ERROR, { cause: err, retryable: false });
}
