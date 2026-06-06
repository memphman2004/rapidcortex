import type { ZodError } from "zod";

/**
 * Maps Zod failures to a client-safe message.
 * In production (or when RC_HIDE_VALIDATION_DETAILS=true), never return field-level Zod text
 * (can leak schema shape and internal keys). Use generic copy instead.
 */
export function validationErrorMessageForClient(err: ZodError): string {
  const hide =
    process.env.NODE_ENV === "production" || process.env.RC_HIDE_VALIDATION_DETAILS === "true";
  if (hide) return "Invalid request";
  return err.message;
}
