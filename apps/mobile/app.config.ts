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

/** Dev Cognito / API defaults — baked into extra so runtime never misses EXPO_PUBLIC_* . */
const cognitoUserPoolId =
  process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID?.trim() || 'us-east-1_0z6tA6WBs';
const cognitoRegion = process.env.EXPO_PUBLIC_COGNITO_REGION?.trim() || 'us-east-1';
const cognitoMobileClientId =
  process.env.EXPO_PUBLIC_COGNITO_MOBILE_CLIENT_ID?.trim() ||
  process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID?.trim() ||
  '3nkemnrffspnaa0ikp2un6koh0';
const apiBase =
  process.env.EXPO_PUBLIC_API_BASE?.trim() ||
  'https://k26yw4o3xk.execute-api.us-east-1.amazonaws.com';
const apiBase2 =
  process.env.EXPO_PUBLIC_API_BASE_2?.trim() ||
  'https://t4bdwpjfs5.execute-api.us-east-1.amazonaws.com';
const apiBase3 =
  process.env.EXPO_PUBLIC_API_BASE_3?.trim() ||
  'https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com';
const apiBase4 =
  process.env.EXPO_PUBLIC_API_BASE_4?.trim() ||
  'https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com';
const wsBase =
  process.env.EXPO_PUBLIC_WS_BASE?.trim() ||
  'wss://g0wzu18e2k.execute-api.us-east-1.amazonaws.com/dev';

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
    supportsTablet: true,
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
      // Apple rejects listing "NDEF" here (ITMS-90778). Use TAG only; NDEF R/W still works.
      'com.apple.developer.nfc.readersession.formats': ['TAG'],
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
    ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
  },
  plugins: [
    'expo-router',
    'expo-asset',
    'expo-font',
    [
      'expo-local-authentication',
      { faceIDPermission: 'Allow Rapid Cortex to use Face ID for secure login.' },
    ],
    [
      'react-native-nfc-manager',
      {
        nfcPermission: 'Allow Rapid Cortex to program NFC safety reporting tags',
        includeNdefEntitlement: false,
        selectIdentifiers: [],
        systemCodes: [],
      },
    ],
    // Required for App Store (iOS 26 SDK / Xcode 26) on Expo SDK 52.
    './plugins/with-xcode26-fmt-fix.js',
  ],
  extra: {
    eas: { projectId: '2d1ae3e1-5867-48f0-8ed8-a8eb53d920dc' },
    EXPO_PUBLIC_COGNITO_USER_POOL_ID: cognitoUserPoolId,
    EXPO_PUBLIC_COGNITO_REGION: cognitoRegion,
    EXPO_PUBLIC_COGNITO_MOBILE_CLIENT_ID: cognitoMobileClientId,
    EXPO_PUBLIC_API_BASE: apiBase,
    EXPO_PUBLIC_API_BASE_2: apiBase2,
    EXPO_PUBLIC_API_BASE_3: apiBase3,
    EXPO_PUBLIC_API_BASE_4: apiBase4,
    EXPO_PUBLIC_WS_BASE: wsBase,
  },
  owner: 'rapid-cortex',
};

export default config;
