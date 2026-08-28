/**
 * App entry — polyfills before expo-router.
 * Gesture handler must be first or iOS/Android can die before the first screen.
 * Amplify RN is optional at boot: a hang/crash here used to leave a blank spinner.
 *
 * Do not require('expo-splash-screen') here. Direct autolink of that module plus
 * Expo's splash plugin crashed TestFlight 25 (black screen, then native abort).
 * Dark root + error boundary handle the light-mode white flash instead.
 */
import 'react-native-gesture-handler';
import 'react-native-get-random-values';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@aws-amplify/react-native');
} catch (err) {
  console.warn('[entry] @aws-amplify/react-native failed to load', err);
}

import 'expo-router/entry';
