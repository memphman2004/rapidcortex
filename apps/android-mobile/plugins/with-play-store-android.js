/**
 * Play Store v1 (QR/NFC Venue + Campus): keep NFC optional so phones without
 * a reader still install, and fail-closed on backup / cleartext. Unused
 * dangerous permissions are stripped via android.blockedPermissions in
 * app.config.ts — do not declare CAMERA / location / BLE for this listing.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const OPTIONAL_FEATURES = [
  'android.hardware.nfc',
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.location',
  'android.hardware.location.gps',
  'android.hardware.location.network',
  'android.hardware.bluetooth',
  'android.hardware.bluetooth_le',
  'android.hardware.microphone',
];

/**
 * @param {object} manifest
 * @param {string} name
 * @param {boolean} required
 */
function upsertUsesFeature(manifest, name, required) {
  const list = Array.isArray(manifest.manifest['uses-feature'])
    ? [...manifest.manifest['uses-feature']]
    : [];
  const existing = list.find((entry) => entry?.$?.['android:name'] === name);
  if (existing) {
    existing.$ = { ...existing.$, 'android:required': required ? 'true' : 'false' };
  } else {
    list.push({
      $: { 'android:name': name, 'android:required': required ? 'true' : 'false' },
    });
  }
  manifest.manifest['uses-feature'] = list;
}

/**
 * @param {object} manifest AndroidManifest XML JSON
 * @returns {object}
 */
function applyPlayStoreAndroidManifest(manifest) {
  const applications = manifest?.manifest?.application;
  const app = Array.isArray(applications) ? applications[0] : applications;
  if (!app || typeof app !== 'object' || !app.$) {
    throw new Error('[play-store-android] AndroidManifest has no application');
  }
  app.$['android:allowBackup'] = 'false';
  app.$['android:usesCleartextTraffic'] = 'false';
  for (const name of OPTIONAL_FEATURES) {
    upsertUsesFeature(manifest, name, false);
  }
  return manifest;
}

function withPlayStoreAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    applyPlayStoreAndroidManifest(cfg.modResults);
    return cfg;
  });
}

module.exports = withPlayStoreAndroid;
module.exports.OPTIONAL_FEATURES = OPTIONAL_FEATURES;
module.exports.upsertUsesFeature = upsertUsesFeature;
module.exports.applyPlayStoreAndroidManifest = applyPlayStoreAndroidManifest;
