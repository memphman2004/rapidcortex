/** Standard JSON error envelope for `/api/v1/*` (RC Lite) — aligns with Stripe/Plaid quality bar. */

export type RcLiteApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
    docsUrl?: string;
    /** Extra structured diagnostics (never include secrets). */
    details?: Record<string, unknown>;
  };
};

export const RC_LITE_ERROR_CODES = {
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  INVALID_API_KEY: "invalid_api_key",
  API_KEY_REVOKED: "api_key_revoked",
  RATE_LIMITED: "rate_limited",
  NOT_FOUND: "not_found",
  VALIDATION: "validation_error",
  IDEMPOTENCY_CONFLICT: "idempotency_conflict",
  IDEMPOTENCY_REQUIRED: "idempotency_required",
  NOT_IMPLEMENTED: "not_implemented",
  INTERNAL: "internal_error",
  CAD_EXPORT_MAPPING_FAILED: "cad_export_mapping_failed",
  WEBHOOK_SIGNATURE_INVALID: "webhook_signature_invalid",
} as const;

export type RcLiteErrorCatalogEntry = {
  code: keyof typeof RC_LITE_ERROR_CODES;
  slug: string;
  title: string;
  description: string;
  defaultRetryable: boolean;
};

/** Human-readable registry for `/developers/docs/errors`. */

export const RC_LITE_ERROR_CATALOG: readonly RcLiteErrorCatalogEntry[] = [
  {
    code: "UNAUTHORIZED",
    slug: "unauthorized",
    title: "Missing credentials",
    description: "The request lacks an RC Lite credential header.",
    defaultRetryable: false,
  },
  {
    code: "INVALID_API_KEY",
    slug: "invalid_api_key",
    title: "Invalid API key",
    description: "The presented key is missing, malformed, or not recognized for this environment.",
    defaultRetryable: false,
  },
  {
    code: "API_KEY_REVOKED",
    slug: "api_key_revoked",
    title: "API key revoked",
    description: "The key was revoked, rotated, or explicitly disabled.",
    defaultRetryable: false,
  },
  {
    code: "RATE_LIMITED",
    slug: "rate_limited",
    title: "Rate limited",
    description: "Tenant or key exceeded plan RPM/burst windows. Honor Retry-After headers.",
    defaultRetryable: true,
  },
  {
    code: "IDEMPOTENCY_REQUIRED",
    slug: "idempotency_required",
    title: "Idempotency key required",
    description: "POST/PUT/PATCH to this route requires an Idempotency-Key header to prevent duplicate CAD/billing writes.",
    defaultRetryable: false,
  },
  {
    code: "IDEMPOTENCY_CONFLICT",
    slug: "idempotency_conflict",
    title: "Idempotency conflict",
    description: "The same Idempotency-Key was reused with different payload fingerprints.",
    defaultRetryable: false,
  },
  {
    code: "CAD_EXPORT_MAPPING_FAILED",
    slug: "cad_export_mapping_failed",
    title: "CAD export mapping failed",
    description: "The incident payload could not be mapped onto the nominated CAD adapter schema.",
    defaultRetryable: false,
  },
  {
    code: "NOT_IMPLEMENTED",
    slug: "not_implemented",
    title: "Not implemented",
    description: "The route exists but upstream processing is still being provisioned.",
    defaultRetryable: true,
  },
];
