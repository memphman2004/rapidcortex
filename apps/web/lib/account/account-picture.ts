/**
 * Per-account welcome banner + avatar images (browser localStorage).
 * Keys are scoped by Cognito user id so each account keeps its own picture.
 */

export function accountAvatarStorageKey(userId: string): string {
  return `rc-account-avatar:${userId}`;
}

/** RC Admin console welcome background (per user + env). */
export function rcAdminBgStorageKey(userId: string, envId: string): string {
  return `rc-admin-bg:user:${userId}:${envId}`;
}

/** PSAP / campus / venue console welcome background (per user + agency). */
export function consoleBgStorageKey(
  surface: "psap" | "campus" | "venue",
  userId: string,
  agencyId: string,
): string {
  return `rc-${surface}-bg:user:${userId}:${agencyId}`;
}

export function readLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

export function removeLocalStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Read avatar; falls back to empty when userId missing. */
export function readAccountAvatar(userId: string | undefined | null): string | null {
  if (!userId) return null;
  return readLocalStorage(accountAvatarStorageKey(userId));
}

export function writeAccountAvatar(userId: string, dataUrl: string): void {
  writeLocalStorage(accountAvatarStorageKey(userId), dataUrl);
  try {
    window.dispatchEvent(new CustomEvent("rc-account-avatar-changed", { detail: { userId } }));
  } catch {
    /* ignore */
  }
}

export function clearAccountAvatar(userId: string): void {
  removeLocalStorage(accountAvatarStorageKey(userId));
  try {
    window.dispatchEvent(new CustomEvent("rc-account-avatar-changed", { detail: { userId } }));
  } catch {
    /* ignore */
  }
}

/**
 * Load per-user console bg, migrating once from the legacy agency/env-only key.
 */
export function loadConsoleBg(opts: {
  userId: string;
  keyed: string;
  legacyKey: string;
}): string | null {
  const existing = readLocalStorage(opts.keyed);
  if (existing) return existing;
  const legacy = readLocalStorage(opts.legacyKey);
  if (legacy && opts.userId) {
    writeLocalStorage(opts.keyed, legacy);
    return legacy;
  }
  return null;
}
