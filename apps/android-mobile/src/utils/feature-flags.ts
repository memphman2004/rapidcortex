/**
 * Public product gates for the mobile app.
 * Safe & Sound stays in the codebase for a later release; default is hidden.
 */
export function isSafeSoundPublicEnabled(): boolean {
  const raw = process.env.EXPO_PUBLIC_ENABLE_SAFE_SOUND?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * Marketing "Enter the Cortex" animation before Venue/Campus selection.
 * Off unless explicitly enabled — TestFlight must reach product selection
 * without a tap that can hang on AsyncStorage.
 */
export function isEnterSplashEnabled(): boolean {
  const raw = process.env.EXPO_PUBLIC_ENABLE_ENTER_SPLASH?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}
