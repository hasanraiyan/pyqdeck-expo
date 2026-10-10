import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A one-line record of the last "sync now" nudge this phone received, so you can
 * tell whether background sync really works without a debugger: Settings shows
 * it, and "Test background sync" sends a nudge to the phone on demand. Holds no
 * progress content - only when it ran and how it ended.
 */

const KEY = 'pyqdeck:bg_last_run';

export type NudgeVia = 'headless' | 'foreground';

export interface NudgeRun {
  at: number;
  via: NudgeVia;
  /** e.g. 'synced', 'skipped: no signed-in owner', 'error' */
  outcome: string;
}

const listeners = new Set<() => void>();
export const subscribeNudgeRun = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export async function recordNudgeRun(via: NudgeVia, outcome: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), via, outcome }));
    listeners.forEach((fn) => fn());
  } catch {}
}

export async function readNudgeRun(): Promise<NudgeRun | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NudgeRun) : null;
  } catch {
    return null;
  }
}
