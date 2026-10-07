import type { AiErrorCode } from "./aiErrorCodes.js";

export class NormalizedAiError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;
  readonly httpStatus: number;
  /** Safe for logs — never include API keys or raw provider bodies. */
  readonly publicMessage: string;

  constructor(opts: {
    code: AiErrorCode;
    retryable: boolean;
    httpStatus?: number;
    publicMessage: string;
    cause?: unknown;
  }) {
    super(opts.publicMessage);
    this.name = "NormalizedAiError";
    this.code = opts.code;
    this.retryable = opts.retryable;
    this.httpStatus = opts.httpStatus ?? 503;
    this.publicMessage = opts.publicMessage;
    if (opts.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}
