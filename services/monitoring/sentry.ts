/**
 * Sentry crash reporting — init as early as possible (before UI).
 * DSN from EXPO_PUBLIC_SENTRY_DSN; no-op when unset (local/dev without Sentry).
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || '';

export const isSentryEnabled = dsn.length > 0;

/** Register with expo-router navigation container when Sentry is on. */
export const sentryNavigationIntegration = isSentryEnabled
  ? Sentry.reactNavigationIntegration({
      enableTimeToInitialDisplay: true,
    })
  : null;

export function initSentry(): void {
  if (!isSentryEnabled) {
    if (__DEV__) {
      console.info('[Sentry] skipped — EXPO_PUBLIC_SENTRY_DSN not set');
    }
    return;
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0';
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  const androidCode = Constants.expoConfig?.android?.versionCode;
  const dist =
    Platform.OS === 'ios'
      ? String(iosBuild ?? '')
      : Platform.OS === 'android'
        ? String(androidCode ?? '')
        : 'web';

  Sentry.init({
    dsn,
    enabled: true,
    debug: __DEV__,
    environment: __DEV__ ? 'development' : 'production',
    release: `gustra@${appVersion}+${Platform.OS}.${dist || '0'}`,
    dist: dist || undefined,
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
    sendDefaultPii: false,
    integrations: sentryNavigationIntegration
      ? [sentryNavigationIntegration]
      : [],
    beforeSend(event) {
      if (!isSentryEnabled) return null;
      return event;
    },
  });

  Sentry.setTag('platform', Platform.OS);
  if (iosBuild) Sentry.setTag('ios.buildNumber', String(iosBuild));
  if (androidCode != null) {
    Sentry.setTag('android.versionCode', String(androidCode));
  }
}

export function captureBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
): void {
  if (!isSentryEnabled) return;
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
}

export { Sentry };
