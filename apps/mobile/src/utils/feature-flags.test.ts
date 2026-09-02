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
