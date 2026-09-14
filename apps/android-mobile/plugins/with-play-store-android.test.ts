import { describe, expect, it } from 'vitest';
import {
  OPTIONAL_FEATURES,
  applyPlayStoreAndroidManifest,
  upsertUsesFeature,
} from './with-play-store-android.js';

function emptyManifest() {
  return {
    manifest: {
      application: [{ $: { 'android:name': '.MainApplication', 'android:allowBackup': 'true' } }],
    },
  };
}

describe('with-play-store-android', () => {
  it('disables backup and cleartext and marks hardware features optional', () => {
    const next = applyPlayStoreAndroidManifest(emptyManifest());
    const app = next.manifest.application[0];
    expect(app.$['android:allowBackup']).toBe('false');
    expect(app.$['android:usesCleartextTraffic']).toBe('false');
    const names = next.manifest['uses-feature'].map((entry: { $: { 'android:name': string } }) => entry.$['android:name']);
    for (const name of OPTIONAL_FEATURES) {
      expect(names).toContain(name);
    }
    expect(
      next.manifest['uses-feature'].every(
        (entry: { $: { 'android:required': string } }) => entry.$['android:required'] === 'false',
      ),
    ).toBe(true);
  });

  it('overwrites an existing required NFC feature to optional', () => {
    const manifest = emptyManifest();
    manifest.manifest['uses-feature'] = [
      { $: { 'android:name': 'android.hardware.nfc', 'android:required': 'true' } },
    ];
    upsertUsesFeature(manifest, 'android.hardware.nfc', false);
    expect(manifest.manifest['uses-feature']).toHaveLength(1);
    expect(manifest.manifest['uses-feature'][0].$['android:required']).toBe('false');
  });

  it('throws when the application node is missing', () => {
    expect(() => applyPlayStoreAndroidManifest({ manifest: {} })).toThrow(/no application/);
  });
});
