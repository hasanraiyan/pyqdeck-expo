import { Platform } from 'react-native';

// Firebase Analytics is native-only (no web build of @react-native-firebase),
// and a missing/misconfigured google-services.json must never break the app,
// so every call is guarded and the module is loaded lazily.
type AnalyticsModule = typeof import('@react-native-firebase/analytics');

let mod: AnalyticsModule | null | undefined;

function load(): AnalyticsModule | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === 'web' || __DEV__) {
    mod = null;
    return mod;
  }
  try {
    mod = require('@react-native-firebase/analytics') as AnalyticsModule;
  } catch {
    mod = null;
  }
  return mod;
}

/** Fire-and-forget event. Never throws. Do not pass personal data. */
export function logEvent(name: string, params?: Record<string, string | number | boolean>) {
  try {
    const m = load();
    if (m) m.logEvent(m.getAnalytics(), name, params);
  } catch {
    // analytics must never affect the app
  }
}

export function logScreenView(screenName: string) {
  try {
    const m = load();
    if (m) {
      void m
        .logScreenView(m.getAnalytics(), { screen_name: screenName, screen_class: screenName })
        .catch(() => {});
    }
  } catch {
    // analytics must never affect the app
  }
}
