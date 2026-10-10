import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which account settings changed on this device and still need pushing. Kept
 * apart from settingsSync.ts so the settings modules can mark a change without
 * importing the sync code (which imports them).
 */

export type SettingName = 'askAiEngine' | 'readingLayout' | 'volumeScroll';

const PENDING_KEY = 'pyqdeck:settings_pending';

let onChange: (() => void) | null = null;
/** The sync engine registers here so a change schedules a sync. */
export function setSettingChangeHandler(fn: (() => void) | null): void {
  onChange = fn;
}

export async function readPendingSettings(): Promise<Set<SettingName>> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export async function markSettingPending(name: SettingName): Promise<void> {
  try {
    const pending = await readPendingSettings();
    pending.add(name);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...pending]));
  } catch {}
  onChange?.();
}

export async function clearPendingSettings(names: SettingName[]): Promise<void> {
  try {
    const pending = await readPendingSettings();
    names.forEach((n) => pending.delete(n));
    if (pending.size === 0) await AsyncStorage.removeItem(PENDING_KEY);
    else await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...pending]));
  } catch {}
}
