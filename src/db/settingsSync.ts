import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAccountSettings,
  putAccountSettings,
  syncRecents as syncRecentsApi,
  type AccountSettings,
} from '../api';
import { ASK_AI_ENGINES, ASK_AI_KEY } from '../utils/askAi';
import { applyOldUiFromAccount } from '../utils/settings';
import {
  getRecentNotes,
  getRecentStudies,
  replaceRecents,
  type RecentNote,
  type RecentStudy,
} from '../utils/recentStudy';
import {
  clearPendingSettings,
  readPendingSettings,
  type SettingName,
} from './settingsPending';

/**
 * Account-backed app settings: the "Ask AI" engine, the question reading
 * layout and volume-key scrolling.
 *
 * The local copy stays what the app reads, so it works signed out and offline.
 * Once signed in the account is the source of truth:
 *
 *  - a setting changed on this device is pending and is pushed on the next sync;
 *  - otherwise the account's value, if it has one, replaces the local one;
 *  - a setting the account has never chosen adopts what this device already has.
 *
 * Runs at the end of every sync round (see progressSync.ts), so it inherits the
 * engine's gating, backoff and 401 handling.
 */

const OLD_UI_KEY = 'old_ui_enabled';
const VOLUME_KEY = 'volume_scroll_enabled';

interface Handler<T> {
  /** The local value, or null when this device has never chosen. */
  readLocal: () => Promise<T | null>;
  writeLocal: (value: T) => Promise<void>;
  isValid: (value: unknown) => value is T;
}

const askAi: Handler<string> = {
  readLocal: async () => {
    const raw = await AsyncStorage.getItem(ASK_AI_KEY);
    return ASK_AI_ENGINES.some((e) => e.id === raw) ? raw : null;
  },
  writeLocal: (v) => AsyncStorage.setItem(ASK_AI_KEY, v),
  isValid: (v): v is string => ASK_AI_ENGINES.some((e) => e.id === v),
};

const readingLayout: Handler<string> = {
  readLocal: async () => {
    const raw = await AsyncStorage.getItem(OLD_UI_KEY);
    return raw === '1' ? 'cards' : raw === '0' ? 'accordion' : null;
  },
  writeLocal: (v) => applyOldUiFromAccount(v === 'cards'),
  isValid: (v): v is string => v === 'accordion' || v === 'cards',
};

const volumeScroll: Handler<boolean> = {
  readLocal: async () => {
    const raw = await AsyncStorage.getItem(VOLUME_KEY);
    return raw === '1' ? true : raw === '0' ? false : null;
  },
  writeLocal: (v) => AsyncStorage.setItem(VOLUME_KEY, v ? '1' : '0'),
  isValid: (v): v is boolean => typeof v === 'boolean',
};

const HANDLERS: { name: Exclude<SettingName, 'recents'>; handler: Handler<any> }[] = [
  { name: 'askAiEngine', handler: askAi },
  { name: 'readingLayout', handler: readingLayout },
  { name: 'volumeScroll', handler: volumeScroll },
];

export async function syncAccountSettings(): Promise<void> {
  const pending = await readPendingSettings();
  const remote = await getAccountSettings();

  const toPush: Partial<AccountSettings> = {};
  for (const { name, handler } of HANDLERS) {
    const local = await handler.readLocal().catch(() => null);
    const remoteValue = remote[name];
    const remoteSet = handler.isValid(remoteValue);

    if (local !== null && (pending.has(name) || !remoteSet)) {
      // A local change (or a first sign-in on an account that never chose).
      if (local !== remoteValue) (toPush as Record<string, unknown>)[name] = local;
    } else if (remoteSet && remoteValue !== local) {
      await handler.writeLocal(remoteValue).catch(() => {});
    }
  }

  if (Object.keys(toPush).length > 0) await putAccountSettings(toPush);
  await clearPendingSettings(HANDLERS.map((h) => h.name));
}

/**
 * Jump Back In across devices: send this device's lists, adopt the merged lists
 * the account returns. Runs every time (it is one small request) because the
 * merge is what brings in what was opened on another device.
 */
export async function syncRecents(): Promise<void> {
  const [study, notes] = await Promise.all([getRecentStudies(), getRecentNotes()]);
  const merged = await syncRecentsApi({ recentStudy: study, recentNotes: notes });
  await replaceRecents(
    (merged.recentStudy ?? []) as RecentStudy[],
    (merged.recentNotes ?? []) as RecentNote[]
  );
  await clearPendingSettings(['recents']);
}
