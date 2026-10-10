import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccountSettings, RecentsPayload, SyncAllResponse } from '../api';
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
  markSettingPending,
  notifySettingsApplied,
  readPendingSettings,
  type SettingName,
} from './settingsPending';

/**
 * The non-progress half of the combined sync request: account settings (Ask AI
 * engine, reading layout, volume scroll) and Jump Back In.
 *
 * This module only builds the request sections and applies the response; the
 * sync engine (progressSync.ts) sends them inside the one POST /api/me/sync, so
 * a round is a single request.
 *
 * Settings: the local copy is what the app reads (it works signed out and
 * offline). A setting changed on this device is pending and travels as a
 * change; otherwise the account's value, if it has one, replaces the local one;
 * a setting the account has never chosen adopts what this device already has.
 *
 * Recents: this device's lists are sent every time; the server merges them with
 * the account's and returns the result, which replaces the local lists - unless
 * something was opened while the request was in flight, in which case the next
 * round settles it.
 */

const OLD_UI_KEY = 'old_ui_enabled';
const VOLUME_KEY = 'volume_scroll_enabled';

type AccountSettingName = Exclude<SettingName, 'recents'>;

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

const syllabusBranch: Handler<string> = {
  readLocal: async () => (await AsyncStorage.getItem('selected_syllabus_branch')) || null,
  writeLocal: (v) => AsyncStorage.setItem('selected_syllabus_branch', v),
  isValid: (v): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v),
};

const HANDLERS: { name: AccountSettingName; handler: Handler<any> }[] = [
  { name: 'askAiEngine', handler: askAi },
  { name: 'readingLayout', handler: readingLayout },
  { name: 'volumeScroll', handler: volumeScroll },
  { name: 'syllabusBranch', handler: syllabusBranch },
];

export interface AuxSent {
  /** The `settings` and `recents` sections to put in the request. */
  request: { settings: { changes?: Partial<AccountSettings> }; recents: RecentsPayload };
  /** What was sent, to tell on the way back whether it is still current. */
  sentChanges: Partial<Record<AccountSettingName, unknown>>;
  sentRecentsJson: string;
  /** First sync for this account on this device: the account's values win. */
  accountWins: boolean;
}

/**
 * `accountWins` is for the first sync after signing in on this device. Whatever
 * this device had chosen while signed out (even just answering the first-time
 * layout prompt) is not an edit to the account, so it must not overwrite what the
 * account already has: nothing is pushed, the account's values are applied, and
 * this device's value is only used for a setting the account has never chosen.
 */
export async function buildAuxRequest(
  opts: { accountWins?: boolean } = {}
): Promise<AuxSent> {
  const accountWins = !!opts.accountWins;
  const pending = accountWins ? new Set<SettingName>() : await readPendingSettings();
  const sentChanges: Partial<Record<AccountSettingName, unknown>> = {};
  for (const { name, handler } of HANDLERS) {
    if (!pending.has(name)) continue;
    const local = await handler.readLocal().catch(() => null);
    if (local !== null) sentChanges[name] = local;
  }
  const [recentStudy, recentNotes] = await Promise.all([getRecentStudies(), getRecentNotes()]);
  return {
    request: {
      settings: Object.keys(sentChanges).length > 0 ? { changes: sentChanges as Partial<AccountSettings> } : {},
      recents: { recentStudy, recentNotes },
    },
    sentChanges,
    sentRecentsJson: JSON.stringify({ recentStudy, recentNotes }),
    accountWins,
  };
}

/** Applies the settings and recents sections of a sync response. */
export async function applyAuxResponse(
  sent: AuxSent,
  res: Pick<SyncAllResponse, 'settings' | 'recents'>
): Promise<{ needsAnotherRound: boolean }> {
  let needsAnotherRound = false;

  const remote = res.settings;
  if (remote && !('error' in remote)) {
    const stillPending = sent.accountWins ? new Set<SettingName>() : await readPendingSettings();
    for (const { name, handler } of HANDLERS) {
      const local = await handler.readLocal().catch(() => null);
      const remoteValue = remote[name];
      const remoteSet = handler.isValid(remoteValue);

      if (name in sent.sentChanges) {
        // Pushed. Settled only if the student did not change it again meanwhile.
        if (local === sent.sentChanges[name]) await clearPendingSettings([name]);
        else needsAnotherRound = true;
      } else if (stillPending.has(name)) {
        needsAnotherRound = true; // changed mid-flight: next round pushes it
      } else if (remoteSet && remoteValue !== local) {
        await handler.writeLocal(remoteValue).catch(() => {});
        if (sent.accountWins) await clearPendingSettings([name]);
        notifySettingsApplied();
      } else if (remoteSet && sent.accountWins) {
        await clearPendingSettings([name]); // same value both sides: nothing pending
      } else if (!remoteSet && local !== null) {
        // The account never chose, this device did: adopt it on the next round.
        await markSettingPending(name);
        needsAnotherRound = true;
      }
    }
  }

  const merged = res.recents;
  if (merged && !('error' in merged)) {
    const [study, notes] = await Promise.all([getRecentStudies(), getRecentNotes()]);
    const unchanged =
      JSON.stringify({ recentStudy: study, recentNotes: notes }) === sent.sentRecentsJson;
    if (unchanged) {
      await replaceRecents(
        (merged.recentStudy ?? []) as RecentStudy[],
        (merged.recentNotes ?? []) as RecentNote[]
      );
      await clearPendingSettings(['recents']);
    } else {
      needsAnotherRound = true;
    }
  }

  return { needsAnotherRound };
}
