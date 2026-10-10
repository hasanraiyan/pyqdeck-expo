import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { clearQueryCache } from '../api/queryClient';
import { clearSyllabusProgress } from '../db/syllabusProgress';
import { planWipe, WIPE_PENDING_KEY } from '../db/storageRegistry';
import { clearPendingAction } from './pendingAction';
import { navigationRef } from '../utils/navigationRef';

/**
 * Removes everything that belongs to the signed-in student from this device,
 * so the next person to use the phone starts clean (docs/SRS-account-progress-
 * sync-android.md, AND-FR-20..29).
 *
 * Driven by the storage registry: user data, cache and any unregistered key go;
 * device preferences and housekeeping stay (onboarding, ad and review counters,
 * the chosen backend origin).
 *
 * Crash safe: a journal flag is set before the first removal and cleared after
 * the last. If the app is killed mid-wipe, the flag is still there at the next
 * launch and bootWipeCheck() finishes the job before any screen reads data.
 * Every step runs even if an earlier one failed; a failure keeps the flag set
 * so the wipe is retried.
 */

type Hook = () => void;
const hooks = new Set<Hook>();

/** In-memory state that mirrors wiped data (sync engine status, etc.) registers here. */
export function registerWipeHook(fn: Hook): () => void {
  hooks.add(fn);
  return () => {
    hooks.delete(fn);
  };
}

let running: Promise<void> | null = null;

async function step(name: string, fn: () => Promise<void> | void, failures: string[]) {
  try {
    await fn();
  } catch (err) {
    failures.push(name);
    // Step name only - never any user data.
    Sentry.captureException(err, { tags: { wipeStep: name } });
  }
}

async function run(reason: string): Promise<void> {
  const failures: string[] = [];

  // Journal first: if anything below is interrupted, launch finishes it.
  try {
    await AsyncStorage.setItem(WIPE_PENDING_KEY, reason);
  } catch (err) {
    failures.push('journal');
    Sentry.captureException(err, { tags: { wipeStep: 'journal' } });
  }

  await step('pending-action', () => clearPendingAction(), failures);

  await step(
    'progress',
    async () => {
      // Progress goes first and on its own so its in-memory state resets too.
      await clearSyllabusProgress();
    },
    failures
  );

  await step(
    'storage',
    async () => {
      const keys = await AsyncStorage.getAllKeys();
      const plan = planWipe(keys);
      if (__DEV__ && plan.unregistered.length > 0) {
        console.warn(
          '[wipe] AsyncStorage keys not in src/db/storageRegistry.ts (treated as user data):',
          plan.unregistered
        );
      }
      if (plan.remove.length > 0) await AsyncStorage.multiRemove(plan.remove);
    },
    failures
  );

  await step('query-cache', () => clearQueryCache(), failures);

  if (Platform.OS === 'web') {
    await step(
      'web-storage',
      () => {
        const storage = (globalThis as any).localStorage;
        if (!storage) return;
        const keys = Object.keys(storage);
        const kept = new Set(['pyqdeck:onboarded']);
        keys.filter((k) => !kept.has(k) && planWipe([k]).remove.length > 0).forEach((k) =>
          storage.removeItem(k)
        );
      },
      failures
    );
  }

  await step(
    'hooks',
    () => {
      hooks.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    },
    failures
  );

  // Never leave the previous student's detail screens on the stack.
  await step(
    'navigation',
    () => {
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Browse' } }] });
      }
    },
    failures
  );

  if (failures.length === 0) {
    try {
      await AsyncStorage.removeItem(WIPE_PENDING_KEY);
    } catch {}
  }
}

/** Idempotent; concurrent callers share one run. */
export function wipeUserData(reason = 'sign-out'): Promise<void> {
  running ??= run(reason).finally(() => {
    running = null;
  });
  return running;
}

/** True when a previous wipe did not finish. */
export async function isWipePending(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WIPE_PENDING_KEY)) !== null;
  } catch {
    return false;
  }
}

/** Launch check: finish an interrupted wipe before anything reads user data. */
export async function bootWipeCheck(): Promise<boolean> {
  if (!(await isWipePending())) return false;
  await wipeUserData('resume');
  return true;
}
