/**
 * Public self-signup is OFF by default. Rapid Cortex staff/admin-led provisioning is the primary model.
 */
export function isPublicSignupUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP === "1";
}

/**
 * Server-side guard for signup/confirmation APIs.
 * Set explicitly to true only for controlled internal testing.
 */
export function isPublicSignupServerEnabled(): boolean {
  return process.env.ENABLE_PUBLIC_SIGNUP === "true";
}
