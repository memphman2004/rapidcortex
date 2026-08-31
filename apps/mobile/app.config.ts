import type { ExpoConfig } from 'expo/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * First App Store / TestFlight submission: QR/NFC field tool for Venue + Campus staff.
 * Safe & Sound UI stays flag-gated. react-native-ble-plx is still linked, so iOS
 * requires NSBluetoothAlwaysUsageDescription (ITMS-90683) even when BLE is unused.
 * Do not add bluetooth-central UIBackgroundModes until Guardian ships.
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
const appOrigin = process.env.EXPO_PUBLIC_APP_ORIGIN?.trim() || 'https://app.rapidcortex.us';
/** Unset until a Sentry project exists — crash-reporting.ts no-ops without a DSN. */
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || '';

const config: ExpoConfig = {
  name: 'Rapid Cortex',
  slug: 'rapid-cortex',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Light-mode "automatic" makes the RCT root white the instant native splash hides
  // (TestFlight 24: branded splash, then blank white). This app is dark-only.
  userInterfaceStyle: 'dark',
  backgroundColor: '#00040e',
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
    userInterfaceStyle: 'dark',
    infoPlist: {
      NSCameraUsageDescription:
        'Rapid Cortex uses the camera to scan QR codes for sign location setup.',
      NFCReaderUsageDescription:
        'Rapid Cortex uses NFC to program safety reporting tags for campus and venue locations.',
      NSFaceIDUsageDescription:
        'Allow Rapid Cortex to use Face ID for secure login.',
      // ITMS-90683: ble-plx links CoreBluetooth; purpose string required even if unused.
      NSBluetoothAlwaysUsageDescription:
        'Rapid Cortex uses Bluetooth to pair optional Guardian safety devices. QR and NFC location setup do not require Bluetooth.',
      NSBluetoothPeripheralUsageDescription:
        'Rapid Cortex uses Bluetooth to pair optional Guardian safety devices. QR and NFC location setup do not require Bluetooth.',
      // Linked expo-location / react-native-maps initialize Core Location at process start.
      // Missing these strings SIGABRT as soon as the native splash appears.
      NSLocationWhenInUseUsageDescription:
        'Rapid Cortex uses your location to place safety codes and optional Guardian device maps.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Rapid Cortex can use location in the background only when you enable Guardian device tracking.',
      NSLocationAlwaysUsageDescription:
        'Rapid Cortex can use location in the background only when you enable Guardian device tracking.',
      NSMicrophoneUsageDescription:
        'Rapid Cortex may use the microphone when you record video while scanning a QR code.',
      NSPhotoLibraryUsageDescription:
        'Rapid Cortex saves QR code images to your photo library when you choose Save.',
      NSPhotoLibraryAddUsageDescription:
        'Rapid Cortex saves QR code images to your photo library when you choose Save.',
      ITSAppUsesNonExemptEncryption: false,
      // Expo AppDelegate implements didReceiveRemoteNotification:fetchCompletionHandler:.
      // Without this key iOS logs a launch warning (not the TestFlight 32 abort).
      UIBackgroundModes: ['remote-notification', 'fetch'],
    },
    entitlements: {
      // Apple rejects listing "NDEF" here (ITMS-90778). Use TAG only; NDEF R/W still works.
      'com.apple.developer.nfc.readersession.formats': ['TAG'],
    },
  },
  android: {
    package: 'us.rapidcortex.app',
    versionCode: 1,
    userInterfaceStyle: 'dark',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#00040e',
    },
    permissions: [
      'android.permission.NFC',
      'android.permission.CAMERA',
      'android.permission.VIBRATE',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
    ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
  },
  plugins: [
    'expo-router',
    'expo-asset',
    'expo-font',
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: '35.0.0',
        },
      },
    ],
    [
      'expo-notifications',
      {
        enableBackgroundRemoteNotifications: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Rapid Cortex uses your location to place safety codes and optional Guardian device maps.',
        locationAlwaysAndWhenInUsePermission:
          'Rapid Cortex can use location in the background only when you enable Guardian device tracking.',
        isIosBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Rapid Cortex uses the camera to scan QR codes for sign location setup.',
        microphonePermission:
          'Rapid Cortex may use the microphone when you record video while scanning a QR code.',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission:
          'Rapid Cortex saves QR code images to your photo library when you choose Save.',
        savePhotosPermission:
          'Rapid Cortex saves QR code images to your photo library when you choose Save.',
      },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'Allow Rapid Cortex to use Face ID for secure login.' },
    ],
    [
      'react-native-ble-plx',
      {
        isBackgroundEnabled: false,
        bluetoothAlwaysPermission:
          'Rapid Cortex uses Bluetooth to pair optional Guardian safety devices. QR and NFC location setup do not require Bluetooth.',
      },
    ],
    [
      'react-native-nfc-manager',
      {
        nfcPermission: 'Allow Rapid Cortex to program NFC safety reporting tags',
        // ITMS-90778: NDEF in readersession.formats is rejected; TAG is required.
        includeNdefEntitlement: false,
        selectIdentifiers: [],
        systemCodes: [],
      },
    ],
    // Runs after nfc-manager plugin — force TAG-only (strips any injected NDEF).
    './plugins/with-nfc-tag-only.js',
    // Pin ExpoModulesCore to RN 0.76 before pod install (hoisted RN 0.80 peer).
    './plugins/with-pin-expo-modules-core-rn.js',
    // Nest commander 7.x under expo-modules-autolinking (RN 0.76 hoists commander 12).
    './plugins/with-pin-autolinking-commander.js',
    // Required for App Store (iOS 26 SDK / Xcode 26) on Expo SDK 52.
    './plugins/with-xcode26-fmt-fix.js',
    // Quote RN codegen / Bundle RN scripts so Xcode works when the repo path has spaces.
    './plugins/with-rn-codegen-space-paths.js',
    // Xcode 15+ script sandbox blocks Expo configure on this volume/path.
    './plugins/with-disable-user-script-sandboxing.js',
    // TestFlight 34 still linked expo-dev-launcher in Release (keyWindow fatal).
    './plugins/with-store-skip-dev-client.js',
    // Xcode 26 refuses to launch without UIScene (TN3187). SceneDelegate must
    // be its own class — UIKit instantiates it. TestFlight 27 died at splash.
    // V6 starts Expo Dev Launcher only in DEBUG after the scene window exists.
    './plugins/with-uiscene-lifecycle.js',
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
    EXPO_PUBLIC_APP_ORIGIN: appOrigin,
    EXPO_PUBLIC_SENTRY_DSN: sentryDsn,
  },
  owner: 'rapid-cortex',
};

export default config;
