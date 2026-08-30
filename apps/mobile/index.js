/**
 * App entry — polyfills, then register "main" synchronously.
 *
 * Do not `import 'expo-router/entry'`. That file calls registerRootComponent
 * inside React.startTransition, so AppRegistry.registerComponent('main') is
 * deferred. UIScene creates the RCT root in scene:willConnectTo on the same
 * tick the bundle finishes evaluating, which produces:
 *   Invariant Violation: "main" has not been registered
 * (TestFlight 30 black screen).
 *
 * Register with AppRegistry directly (not expo's registerRootComponent) so
 * Expo.fx cannot run before 'main' exists.
 *
 * Release RCTFatal throws an uncaught NSException (DEBUG swallows it). That is
 * TestFlight 32's SIGABRT on com.facebook.react.ExceptionsManagerQueue.
 * ErrorUtils here must not call the default handler. Native RCTSetFatalHandler
 * is the other half (with-uiscene-lifecycle V4).
 *
 * Do not require('expo-splash-screen') here. That aborted TestFlight 25.
 */
import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { Component, createElement } from 'react';
import { AppRegistry, Text, View } from 'react-native';

const BOOT_BG = '#00040e';

function installJsFatalGuard() {
  const errorUtils = globalThis.ErrorUtils;
  if (!errorUtils || typeof errorUtils.setGlobalHandler !== 'function') {
    return;
  }
  errorUtils.setGlobalHandler((error, isFatal) => {
    const message = error && error.message ? error.message : String(error);
    const stack = error && error.stack ? error.stack : '';
    console.error('[RapidCortex] js-fatal', isFatal, message, stack);
  });
}

installJsFatalGuard();

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./src/services/crash-reporting').initCrashReporting();
} catch (err) {
  console.warn('[entry] crash reporting init failed', err);
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@aws-amplify/react-native');
} catch (err) {
  console.warn('[entry] @aws-amplify/react-native failed to load', err);
}

function Fallback({ error }) {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : String(error);
  return createElement(
    View,
    {
      style: {
        flex: 1,
        backgroundColor: BOOT_BG,
        justifyContent: 'center',
        paddingHorizontal: 24,
      },
    },
    createElement(
      Text,
      { style: { color: '#F8FAFC', fontSize: 18, fontWeight: '600' } },
      'Rapid Cortex',
    ),
    createElement(
      Text,
      { style: { color: '#94A3B8', marginTop: 12, fontSize: 14 } },
      message,
    ),
  );
}

class BootBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[RapidCortex] boot-boundary', error, info && info.componentStack);
  }

  render() {
    if (this.state.error) {
      return createElement(Fallback, { error: this.state.error });
    }
    try {
      // Lazy so 'main' is registered before expo-router loads the route tree.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { App } = require('expo-router/build/qualified-entry');
      return createElement(App);
    } catch (err) {
      return createElement(Fallback, { error: err });
    }
  }
}

function Root() {
  return createElement(BootBoundary);
}

AppRegistry.registerComponent('main', () => Root);
console.log('[RapidCortex] registered component main');
