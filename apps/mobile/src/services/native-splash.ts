/** Matches `app.config.ts` splash / root window so iOS never flashes the light-mode white RCT view. */
export const NATIVE_BOOT_BACKGROUND = '#00040e';

/** Do not block the UI forever if Inter fails to register in a release binary. */
export const FONT_READY_TIMEOUT_MS = 4000;

/**
 * Ready-to-hide predicate for a future JS splash gate.
 * Do not call expo-splash-screen hideAsync/preventAutoHideAsync from JS —
 * that combination crashed TestFlight 25 (native abort). Native splash
 * auto-dismisses when the first React frame paints.
 */
export function isNativeSplashReadyToHide(options: {
  fontsLoaded: boolean;
  fontError?: Error | null;
  waitExpired: boolean;
}): boolean {
  return options.fontsLoaded || Boolean(options.fontError) || options.waitExpired;
}
