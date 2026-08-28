import { describe, expect, it } from 'vitest';
import { isNativeSplashReadyToHide } from './native-splash';

describe('isNativeSplashReadyToHide', () => {
  it('keeps the native splash until fonts or timeout', () => {
    expect(
      isNativeSplashReadyToHide({
        fontsLoaded: false,
        fontError: null,
        waitExpired: false,
      }),
    ).toBe(false);
  });

  it('hides once Inter is loaded', () => {
    expect(
      isNativeSplashReadyToHide({
        fontsLoaded: true,
        fontError: null,
        waitExpired: false,
      }),
    ).toBe(true);
  });

  it('hides on font error so a missing TTF cannot white-screen forever', () => {
    expect(
      isNativeSplashReadyToHide({
        fontsLoaded: false,
        fontError: new Error('font'),
        waitExpired: false,
      }),
    ).toBe(true);
  });

  it('hides after the boot timeout', () => {
    expect(
      isNativeSplashReadyToHide({
        fontsLoaded: false,
        fontError: null,
        waitExpired: true,
      }),
    ).toBe(true);
  });
});
