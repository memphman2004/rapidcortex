import type { UserContext } from "../types.js";

/** Default enforced password rotation (days). Override with `PASSWORD_MAX_AGE_DAYS`. */
export const PASSWORD_MAX_AGE_DAYS_DEFAULT = 60;
/** Grace period after expiry (days). Override with `PASSWORD_EXPIRY_GRACE_DAYS`; `0` = block immediately when expired. */
export const PASSWORD_EXPIRY_GRACE_DAYS_DEFAULT = 0;

function readIntEnv(v: string | undefined, fallback: number): number {
  const n = Number(v?.trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function getPasswordMaxAgeDays(): number {
  return readIntEnv(
    typeof process !== "undefined" ? process.env.PASSWORD_MAX_AGE_DAYS : undefined,
    PASSWORD_MAX_AGE_DAYS_DEFAULT,
  );
}

export function getPasswordExpiryGraceDays(): number {
  return readIntEnv(
    typeof process !== "undefined" ? process.env.PASSWORD_EXPIRY_GRACE_DAYS : undefined,
    PASSWORD_EXPIRY_GRACE_DAYS_DEFAULT,
  );
}

/** When true, accounts with no recorded password change timestamp must rotate password. */
export function isPasswordChangeRequiredOnFirstLogin(): boolean {
  const raw =
    typeof process !== "undefined" ? process.env.PASSWORD_CHANGE_REQUIRED_ON_FIRST_LOGIN : undefined;
  if (raw == null || raw.trim() === "") return true;
  return !["0", "false", "no", "off"].includes(raw.trim().toLowerCase());
}

/**
 * Parses `custom:pwdChangeReq` (Cognito stores string "true" / "false").
 * Accepts JWT boolean for tests.
 */
export function parsePasswordChangeRequiredFlag(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === false) return false;
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** Age of password in whole days based on UTC `passwordLastChangedAt` ISO string. Returns null when unknown. */
export function getPasswordAgeDays(passwordLastChangedAtIso: string | undefined): number | null {
  if (!passwordLastChangedAtIso?.trim()) return null;
  const t = Date.parse(passwordLastChangedAtIso);
  if (Number.isNaN(t)) return null;
  const ms = Date.now() - t;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function isPasswordExpired(passwordLastChangedAtIso: string | undefined): boolean {
  const age = getPasswordAgeDays(passwordLastChangedAtIso);
  if (age == null) return isPasswordChangeRequiredOnFirstLogin();
  const maxAge = getPasswordMaxAgeDays();
  const grace = getPasswordExpiryGraceDays();
  return age > maxAge + grace;
}

/**
 * Operational consoles require a fresh password rotation when expired or flagged.
 */
export function requiresOperationalPasswordRenewal(user: Pick<UserContext, "passwordLastChangedAt" | "passwordChangeRequired">): boolean {
  if (parsePasswordChangeRequiredFlag(user.passwordChangeRequired)) return true;
  return isPasswordExpired(user.passwordLastChangedAt);
}

export function canUserChangeOwnPassword(user: Pick<UserContext, "role">): boolean {
  const r = user.role;
  /** Human-operator roles — service principals would use separate auth (not modeled here). */
  return (
    r === "dispatcher" ||
    r === "supervisor" ||
    r === "agencyadmin" ||
    r === "agencyit" ||
    r === "analyst" ||
    r === "auditor" ||
    r === "rcsuperadmin" ||
    r === "rcadmin" ||
    r === "rcitadmin"
  );
}

/** Agency admins / IT, RC super-admin, or RC IT admin may force a password renewal flag on a target tenant. */
export function canAdminForcePasswordReset(
  actor: Pick<UserContext, "role" | "agencyId">,
  opts: { targetAgencyId: string },
): boolean {
  if (actor.role === "agencyadmin" || actor.role === "agencyit") {
    return actor.agencyId === opts.targetAgencyId;
  }
  if (actor.role === "rcsuperadmin" || actor.role === "rcitadmin") return true;
  return false;
}
