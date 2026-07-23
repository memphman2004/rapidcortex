/**
 * App entry — polyfills before expo-router.
 * Amplify RN is optional at boot: a hang/crash here used to leave a blank spinner.
 */
import 'react-native-get-random-values';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@aws-amplify/react-native');
} catch (err) {
  console.warn('[entry] @aws-amplify/react-native failed to load', err);
}

import 'expo-router/entry';
