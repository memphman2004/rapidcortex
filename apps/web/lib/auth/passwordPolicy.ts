/** Web re-exports — canonical policy lives in `rapid-cortex-shared/auth/password-policy`. */
export {
  PASSWORD_MAX_AGE_DAYS_DEFAULT,
  PASSWORD_EXPIRY_GRACE_DAYS_DEFAULT,
  getPasswordMaxAgeDays,
  getPasswordExpiryGraceDays,
  isPasswordChangeRequiredOnFirstLogin,
  parsePasswordChangeRequiredFlag,
  getPasswordAgeDays,
  isPasswordExpired,
  requiresOperationalPasswordRenewal,
  canUserChangeOwnPassword,
  canAdminForcePasswordReset,
} from "rapid-cortex-shared/auth/password-policy";
