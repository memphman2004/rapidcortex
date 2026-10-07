/**
 * Server-side secret resolution (AWS-first).
 *
 * **Runtime behavior:** `resolvePlainOrSecretArn` (from `../lib/runtimeSecrets.js`) loads JSON or
 * string secrets from Secrets Manager when an ARN is set; otherwise uses inline env for local dev only.
 *
 * **Never** import this module from browser bundles. Next.js must not reference these exports.
 */
export { clearRuntimeSecretsCacheForTests, resolvePlainOrSecretArn } from "../lib/runtimeSecrets.js";

/** Documented env → purpose (no values). See `docs/security/g3-secrets-manager-proof.md`. */
export const DOCUMENTED_SECRET_ARNS = [
  "OPENAI_API_KEY_SECRET_ARN",
  "ANTHROPIC_API_KEY_SECRET_ARN",
  "EXTERNAL_API_JWT_SECRET_ARN",
  "EXTERNAL_API_ENCRYPTION_KEY_ARN",
  "WEBRTC_TURN_SECRET_ARN",
  "GOOGLE_APPLICATION_CREDENTIALS_SECRET_ARN",
  "INCIDENT_MEDIA_TWILIO_SECRET_ARN / TWILIO_SECRET_ARN",
  "STRIPE_SECRET_ARN",
  "STRIPE_WEBHOOK_SECRET_ARN",
] as const;
