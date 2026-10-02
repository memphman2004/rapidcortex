import type { VoiceErrorCode } from "./voiceErrorCodes.js";
import { VOICE_ERROR_CODES } from "./voiceErrorCodes.js";

export class VoiceProviderError extends Error {
  readonly code: VoiceErrorCode;
  readonly httpStatus?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: VoiceErrorCode,
    opts?: { cause?: unknown; httpStatus?: number; retryable?: boolean },
  ) {
    super(message, opts?.cause ? { cause: opts.cause } : undefined);
    this.name = "VoiceProviderError";
    this.code = code;
    this.httpStatus = opts?.httpStatus;
    this.retryable = opts?.retryable ?? isRetryableVoiceCode(code);
  }
}

export function isRetryableVoiceCode(code: VoiceErrorCode): boolean {
  return (
    code === VOICE_ERROR_CODES.STT_TIMEOUT ||
    code === VOICE_ERROR_CODES.STT_RATE_LIMIT ||
    code === VOICE_ERROR_CODES.STT_PROVIDER_5XX ||
    code === VOICE_ERROR_CODES.TRANSLATION_TIMEOUT ||
    code === VOICE_ERROR_CODES.TRANSLATION_RATE_LIMIT ||
    code === VOICE_ERROR_CODES.TRANSLATION_PROVIDER_5XX ||
    code === VOICE_ERROR_CODES.LANG_DETECT_TIMEOUT
  );
}

export function voiceErrorFromHttpStatus(
  kind: "stt" | "translation" | "lang_detect",
  status: number,
  message: string,
): VoiceProviderError {
  if (status === 401 || status === 403) {
    const code =
      kind === "translation"
        ? VOICE_ERROR_CODES.TRANSLATION_AUTH_ERROR
        : kind === "lang_detect"
          ? VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR
          : VOICE_ERROR_CODES.STT_AUTH_ERROR;
    return new VoiceProviderError(message, code, { httpStatus: status, retryable: false });
  }
  if (status === 429) {
    const code =
      kind === "translation" ? VOICE_ERROR_CODES.TRANSLATION_RATE_LIMIT : VOICE_ERROR_CODES.STT_RATE_LIMIT;
    return new VoiceProviderError(message, code, { httpStatus: status, retryable: true });
  }
  if (status >= 500) {
    const code =
      kind === "translation"
        ? VOICE_ERROR_CODES.TRANSLATION_PROVIDER_5XX
        : VOICE_ERROR_CODES.STT_PROVIDER_5XX;
    return new VoiceProviderError(message, code, { httpStatus: status, retryable: true });
  }
  return new VoiceProviderError(message, VOICE_ERROR_CODES.UNKNOWN_PROVIDER_ERROR, {
    httpStatus: status,
    retryable: false,
  });
}
