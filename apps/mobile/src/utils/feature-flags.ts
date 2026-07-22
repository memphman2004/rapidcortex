/**
 * Public product gates for the mobile app.
 * Safe & Sound stays in the codebase for a later release; default is hidden.
 */
export function isSafeSoundPublicEnabled(): boolean {
  const raw = process.env.EXPO_PUBLIC_ENABLE_SAFE_SOUND?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}
