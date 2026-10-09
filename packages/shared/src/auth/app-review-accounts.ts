/**
 * App Store / Play review demo accounts. Cognito pool MFA stays ON (software token
 * + email OTP). Mobile clients must answer SELECT_MFA_TYPE with SOFTWARE_TOKEN_MFA,
 * silently complete MFA_SETUP for these emails only, then release MFA so the next
 * device (Apple often uses iPhone + iPad) also gets MFA_SETUP instead of a TOTP prompt.
 */
export const APP_REVIEW_SILENT_MFA_EMAILS = [
  "apple-review@nexcortiq.us",
  "appreviewer@nexcortiq.us",
  "appreviewer@rapidcortex.us",
  "appreviewer@rapidcortex.ai",
] as const;

export function isAppReviewSilentMfaEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return (APP_REVIEW_SILENT_MFA_EMAILS as readonly string[]).includes(normalized);
}
