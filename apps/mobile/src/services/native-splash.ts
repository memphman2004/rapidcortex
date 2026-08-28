/** Matches `app.config.ts` splash / root window so iOS never flashes the light-mode white RCT view. */
export const NATIVE_BOOT_BACKGROUND = '#00040e';

/** Do not block the UI forever if Inter fails to register in a release binary. */
export const FONT_READY_TIMEOUT_MS = 4000;

/**
 * Native splash stays up until fonts are usable, font load errors, or the timeout.
 * Returning true means JS may call hideAsync — the branded splash.png should already
 * cover the window until then.
 */
export function isNativeSplashReadyToHide(options: {
  fontsLoaded: boolean;
  fontError?: Error | null;
  waitExpired: boolean;
}): boolean {
  return options.fontsLoaded || Boolean(options.fontError) || options.waitExpired;
}
