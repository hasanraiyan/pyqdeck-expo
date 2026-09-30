import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// API data caching now lives in React Query (src/api/queryClient.ts,
// queries.ts), persisted under the single `pyq_rq_cache` key. This file only
// keeps the storage-level housekeeping: wiping every `pyq_` key and cleaning
// up the hand-written caches that React Query replaced.

/**
 * Wipes all cached content - every cache key in this app is prefixed `pyq_`
 * (including the persisted React Query cache, `pyq_rq_cache`).
 * Leaves behavioral/preference keys (volume_scroll_*, interstitial_*,
 * review_prompt_*, my_solution_votes_v2) untouched.
 *
 * On web AsyncStorage IS localStorage, but the driver's getAllKeys can miss
 * keys its own getItem never stored, so sweep localStorage directly too -
 * otherwise a web session keeps serving stale caches after "Clear" says done.
 */
export async function clearAllCache(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      const storage = (globalThis as any).localStorage;
      if (storage) {
        Object.keys(storage)
          .filter((k) => k.startsWith('pyq_'))
          .forEach((k) => storage.removeItem(k));
      }
    } catch {}
  }

  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith('pyq_'));
  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
}

// -------------------------------------------------------------
// MIGRATIONS
// -------------------------------------------------------------

const MIGRATION_FLAG = 'pyq_cache_migrated_rq';

// Keys written by the pre-React-Query caches. Nothing here is user-authored,
// and the un-scoped solution/question/vote entries carry no subject id so
// they can't be re-keyed (some are poisoned with another subject's data).
const LEGACY_PREFIXES = [
  'pyq_subjects_',
  'pyq_meta_',
  'pyq_q_',
  'pyq_cm_',
  'pyq_syl_',
  'pyq_solution_',
  'pyq_question_',
  'pyq_v2_solution_',
  'pyq_v2_question_',
];
const LEGACY_KEYS = ['pyq_semesters', 'my_solution_votes'];

/**
 * One-time removal of the legacy hand-written cache entries. Safe to re-run;
 * the flag makes it a no-op. Data is refetched on demand by React Query.
 */
export async function migrateToQueryCache(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(MIGRATION_FLAG)) return;
    const keys = await AsyncStorage.getAllKeys();
    const legacy = keys.filter(
      (k) => LEGACY_KEYS.includes(k) || LEGACY_PREFIXES.some((p) => k.startsWith(p))
    );
    if (legacy.length > 0) await AsyncStorage.multiRemove(legacy);
    await AsyncStorage.setItem(MIGRATION_FLAG, '1');
  } catch (e) {
    console.error('Cache migration failed:', e);
  }
}
