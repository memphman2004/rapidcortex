import type { ExpoConfig } from 'expo/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * First App Store / TestFlight submission: QR/NFC field tool for Venue + Campus staff.
 * Guardian / Safe & Sound (BLE + background location) permissions are intentionally omitted —
 * reintroduce those strings, UIBackgroundModes, and related plugins in a later release.
 */
const googleServicesPath = join(__dirname, 'google-services.json');
const hasGoogleServices = existsSync(googleServicesPath);

const config: ExpoConfig = {
  name: 'Rapid Cortex',
  slug: 'rapid-cortex',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'rapidcortex',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'cover',
    backgroundColor: '#00040e',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'us.rapidcortex.app',
    infoPlist: {
      NSCameraUsageDescription:
        'Rapid Cortex uses the camera to scan QR codes for sign location setup.',
      NFCReaderUsageDescription:
        'Rapid Cortex uses NFC to program safety reporting tags for campus and venue locations.',
      NSFaceIDUsageDescription:
        'Allow Rapid Cortex to use Face ID for secure login.',
      ITSAppUsesNonExemptEncryption: false,
    },
    entitlements: {
      'com.apple.developer.nfc.readersession.formats': ['NDEF'],
    },
  },
  android: {
    package: 'us.rapidcortex.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#00040e',
    },
    permissions: [
      'android.permission.NFC',
      'android.permission.CAMERA',
      'android.permission.VIBRATE',
    ],
    // Only wire Firebase when google-services.json is present (push not required for QR/NFC v1).
    ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
  },
  plugins: [
    'expo-router',
    [
      'expo-local-authentication',
      { faceIDPermission: 'Allow Rapid Cortex to use Face ID for secure login.' },
    ],
    [
      'react-native-nfc-manager',
      {
        nfcPermission: 'Allow Rapid Cortex to program NFC safety reporting tags',
        selectIdentifiers: [],
        systemCodes: [],
      },
    ],
  ],
  extra: {
    eas: { projectId: '2d1ae3e1-5867-48f0-8ed8-a8eb53d920dc' },
  },
  // Must match the Expo organization slug at https://expo.dev/accounts exactly.
  owner: 'rapid-cortex',
};

export default config;
