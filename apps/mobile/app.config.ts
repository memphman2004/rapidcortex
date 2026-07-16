import type { ExpoConfig } from 'expo/config';

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
    buildNumber: '1',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Rapid Cortex uses your location to show your position on the map and share it with your emergency contacts when needed.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Rapid Cortex Guardian uses your location in the background to detect emergencies and share your live position with emergency contacts and first responders even when the app is closed.',
      NSLocationAlwaysUsageDescription:
        'Rapid Cortex Guardian uses your location in the background to detect emergencies and share your live position with emergency contacts and first responders even when the app is closed.',
      NSBluetoothAlwaysUsageDescription:
        'Rapid Cortex uses Bluetooth to communicate with your Guardian device and detect its proximity.',
      NSBluetoothPeripheralUsageDescription:
        'Rapid Cortex uses Bluetooth to communicate with your Guardian device.',
      NSCameraUsageDescription:
        'Rapid Cortex uses the camera to scan QR codes for sign location setup.',
      NFCReaderUsageDescription:
        'Rapid Cortex uses NFC to program safety reporting tags for venue and campus deployments.',
      UIBackgroundModes: [
        'bluetooth-central',
        'bluetooth-peripheral',
        'location',
        'fetch',
        'remote-notification',
      ],
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
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.CAMERA',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    ],
    googleServicesFile: './google-services.json',
  },
  plugins: [
    'expo-router',
    'expo-location',
    'expo-notifications',
    [
      'expo-local-authentication',
      { faceIDPermission: 'Allow Rapid Cortex to use Face ID for secure login.' },
    ],
    [
      'react-native-nfc-manager',
      { selectIdentifiers: [], systemCodes: [] },
    ],
  ],
  extra: {
    eas: { projectId: 'REPLACE_WITH_EAS_PROJECT_ID' },
  },
  owner: 'rapidcortex',
};

export default config;
