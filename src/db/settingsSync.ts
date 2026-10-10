import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccountSettings, putAccountSettings } from '../api';
import { ASK_AI_ENGINES, ASK_AI_KEY } from '../utils/askAi';

/**
 * Account-backed app settings. The only one today is the "Ask AI" engine.
 *
 * The local copy (`ask_ai_engine`) stays: it is what the app reads, so it works
 * signed out and offline. Once signed in the account is the source of truth:
 *
 *  - a change made on this device is marked pending and pushed on the next sync;
 *  - otherwise the account's value, if it has one, replaces the local one;
 *  - an account with no choice yet adopts whatever this device already had.
 *
 * Runs at the end of every sync round (see progressSync.ts), so it inherits the
 * engine's gating, backoff and 401 handling.
 */

const PENDING_KEY = 'pyqdeck:ask_ai_pending';

const isEngine = (v: unknown): v is string => ASK_AI_ENGINES.some((e) => e.id === v);

/** Records a local change so the next sync pushes it to the account. */
export async function markAskAiEnginePending(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, '1');
  } catch {}
}

export async function syncAccountSettings(): Promise<void> {
  const [rawLocal, pending] = await Promise.all([
    AsyncStorage.getItem(ASK_AI_KEY).catch(() => null),
    AsyncStorage.getItem(PENDING_KEY).catch(() => null),
  ]);
  const local = isEngine(rawLocal) ? rawLocal : null;

  if (pending && local) {
    await putAccountSettings({ askAiEngine: local });
    await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
    return;
  }

  const remote = await getAccountSettings();
  if (isEngine(remote.askAiEngine)) {
    if (remote.askAiEngine !== local) await AsyncStorage.setItem(ASK_AI_KEY, remote.askAiEngine);
  } else if (local) {
    // First sign-in on an account that never chose: keep this device's choice.
    await putAccountSettings({ askAiEngine: local });
  }
  await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
}
