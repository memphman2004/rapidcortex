import Constants from 'expo-constants';

type SentryModule = typeof import('@sentry/react-native');

let sentryModule: SentryModule | null = null;
let initialized = false;

function readDsn(): string | undefined {
  const fromProcess = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (fromProcess) return fromProcess;
  const extra = Constants.expoConfig?.extra as
    | { EXPO_PUBLIC_SENTRY_DSN?: string }
    | undefined;
  return extra?.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

/**
 * No-ops without a DSN so local/dev builds never require Sentry config.
 * Must be called before anything else boots — a crash before this runs
 * is invisible, which was the original blind spot.
 */
export function initCrashReporting(): void {
  if (initialized) return;
  initialized = true;

  const dsn = readDsn();
  if (!dsn) {
    console.warn('[crash-reporting] EXPO_PUBLIC_SENTRY_DSN not set — Sentry disabled');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentryModule = require('@sentry/react-native') as SentryModule;
    sentryModule.init({
      dsn,
      environment: process.env.APP_ENV ?? 'production',
      enableNativeCrashHandling: true,
      tracesSampleRate: 0,
    });
  } catch (err) {
    sentryModule = null;
    console.warn('[crash-reporting] Sentry init failed', err);
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryModule) {
    console.error('[crash-reporting]', error, context);
    return;
  }
  try {
    sentryModule.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Reporting must never throw back into the caller's error path.
  }
}
