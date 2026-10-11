import AsyncStorage from '@react-native-async-storage/async-storage';
import { emit, on } from '../events/bus';

/**
 * Which account settings changed on this device and still need pushing. Kept
 * apart from settingsSync.ts so the settings modules can mark a change without
 * importing the sync code (which imports them).
 */

export type SettingName = 'askAiEngine' | 'readingLayout' | 'volumeScroll' | 'recents' | 'syllabusBranch';

const PENDING_KEY = 'pyqdeck:settings_pending';

/** Fires after a sync wrote an account setting to local storage (screens re-read). */
export function subscribeSettingsApplied(fn: () => void): () => void {
  return on('settings.applied', () => fn());
}
export const notifySettingsApplied = () => emit('settings.applied');

export async function readPendingSettings(): Promise<Set<SettingName>> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

/**
 * Marking a change announces it on the bus ('setting.changed', or
 * 'recents.changed' for Jump Back In, which waits longer because it changes on
 * every screen opened); the sync coordinator decides when to send.
 * `silent` marks it without announcing: the sync engine uses that when it
 * re-marks a setting INSIDE a round (it schedules its own, limited, follow-up),
 * so marking can never restart sync by itself in a loop.
 */
export async function markSettingPending(
  name: SettingName,
  opts: { silent?: boolean } = {}
): Promise<void> {
  try {
    const pending = await readPendingSettings();
    pending.add(name);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...pending]));
  } catch {}
  if (!opts.silent) {
    if (name === 'recents') emit('recents.changed');
    else emit('setting.changed', { name });
  }
}

export async function clearPendingSettings(names: SettingName[]): Promise<void> {
  try {
    const pending = await readPendingSettings();
    names.forEach((n) => pending.delete(n));
    if (pending.size === 0) await AsyncStorage.removeItem(PENDING_KEY);
    else await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...pending]));
  } catch {}
}
