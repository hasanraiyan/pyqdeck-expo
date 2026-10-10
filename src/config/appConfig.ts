import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getRemoteAppConfig } from '../api';
import {
  DEFAULT_APP_CONFIG,
  sanitizeAppConfig,
  updateStatus,
  type AppConfig,
} from './appConfigLogic';

/**
 * Remote app config: a minimum version, a banner, and kill switches that an
 * admin sets without shipping a build (docs/SRS-admin-features.md, 3.4).
 *
 * Rules that keep it harmless:
 *  - never blocks startup: the app runs on the last good copy (or defaults) and
 *    refreshes in the background;
 *  - a failed or garbage response keeps what we have;
 *  - the last good copy is stored, so it still applies offline.
 */

const CONFIG_KEY = 'pyqdeck:app_config';
const BANNER_DISMISSED_KEY = 'pyqdeck:banner_dismissed';
const UPDATE_PROMPTED_KEY = 'pyqdeck:update_prompted';
const REFRESH_MIN_GAP_MS = 10 * 60 * 1000;

let current: AppConfig = DEFAULT_APP_CONFIG;
let lastFetchAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const set = (next: AppConfig) => {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  listeners.forEach((fn) => fn());
};

export const getAppConfigNow = (): AppConfig => current;

export const subscribeAppConfig = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const getCurrentAppVersion = (): string => Constants.expoConfig?.version ?? '0.0.0';

export const getUpdateStatus = () => updateStatus(current, getCurrentAppVersion());

/** Reads the stored copy. Cheap; called at startup before the first fetch. */
export async function loadCachedAppConfig(): Promise<AppConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (raw) set(sanitizeAppConfig(JSON.parse(raw)));
  } catch {}
  return current;
}

/** Fetches in the background; at most once per 10 minutes unless forced. */
export function refreshAppConfig(opts: { force?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight;
  if (!opts.force && Date.now() - lastFetchAt < REFRESH_MIN_GAP_MS) return Promise.resolve();
  inFlight = (async () => {
    try {
      const fresh = sanitizeAppConfig(await getRemoteAppConfig());
      lastFetchAt = Date.now();
      set(fresh);
      await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(fresh));
    } catch {
      // Offline or a bad response: keep the last good copy.
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

// --- banner ------------------------------------------------------------------

export async function isBannerDismissed(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    return (await AsyncStorage.getItem(BANNER_DISMISSED_KEY)) === id;
  } catch {
    return false;
  }
}

export async function dismissBanner(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(BANNER_DISMISSED_KEY, id);
  } catch {}
}

// --- "update recommended" prompt: once per recommended version ---------------

export async function shouldShowRecommendedPrompt(): Promise<boolean> {
  if (getUpdateStatus() !== 'recommended') return false;
  try {
    return (await AsyncStorage.getItem(UPDATE_PROMPTED_KEY)) !== current.recommendedAppVersion;
  } catch {
    return false;
  }
}

export async function markRecommendedPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(UPDATE_PROMPTED_KEY, current.recommendedAppVersion);
  } catch {}
}
