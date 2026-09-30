import { afterEach, describe, expect, it, vi } from 'vitest';

describe('isEnterSplashEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('skips Enter the Cortex when the flag is unset', async () => {
    vi.stubEnv('EXPO_PUBLIC_ENABLE_ENTER_SPLASH', '');
    const { isEnterSplashEnabled } = await import('./feature-flags');
    expect(isEnterSplashEnabled()).toBe(false);
  });

  it('shows Enter the Cortex only when explicitly enabled', async () => {
    vi.stubEnv('EXPO_PUBLIC_ENABLE_ENTER_SPLASH', '1');
    const { isEnterSplashEnabled } = await import('./feature-flags');
    expect(isEnterSplashEnabled()).toBe(true);
  });
});

describe('isRcTranslateEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults on when unset', async () => {
    vi.stubEnv('EXPO_PUBLIC_ENABLE_RC_TRANSLATE', '');
    const { isRcTranslateEnabled } = await import('./feature-flags');
    expect(isRcTranslateEnabled()).toBe(true);
  });

  it('hides Translator when explicitly disabled', async () => {
    vi.stubEnv('EXPO_PUBLIC_ENABLE_RC_TRANSLATE', '0');
    const { isRcTranslateEnabled } = await import('./feature-flags');
    expect(isRcTranslateEnabled()).toBe(false);
  });
});
