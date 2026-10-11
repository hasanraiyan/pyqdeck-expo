/**
 * Every AsyncStorage key the app owns, with what it holds. wipeUserData()
 * (src/auth/wipeUserData.ts) is driven by this list, so a key that is not
 * registered here is treated as user data and removed on sign-out - the safe
 * default for a shared phone. Register new keys when you add them.
 *
 * Pure (no storage imports) so the wipe plan can be unit tested.
 */

export type StorageCategory = 'user' | 'cache' | 'device';

type Entry =
  | { key: string; category: StorageCategory }
  | { prefix: string; category: StorageCategory };

/** Journal flag: set before a wipe starts, cleared after it finishes. */
export const WIPE_PENDING_KEY = 'pyqdeck:wipe_pending';
/** Clerk id of the account whose data this device currently holds. */
export const OWNER_KEY = 'pyqdeck:owner';

// Exact keys are matched before prefixes, so housekeeping keys that live under
// a cache prefix (pyq_cache_migrated_rq) stay classified as device settings.
export const STORAGE_REGISTRY: Entry[] = [
  // --- device settings and housekeeping: survive sign-out ------------------
  { key: 'volume_scroll_enabled', category: 'device' },
  { key: 'old_ui_enabled', category: 'device' },
  { key: 'question_layout_chosen', category: 'device' },
  { key: 'sidebar_collapsed', category: 'device' },
  { key: 'list_pane_collapsed', category: 'device' },
  { key: 'volume_scroll_hint_seen', category: 'device' },
  { key: 'pyqdeck:onboarded', category: 'device' },
  { key: 'interstitial_opens_since_last_shown', category: 'device' },
  { key: 'interstitial_last_shown_at', category: 'device' },
  { key: 'review_prompt_opens', category: 'device' },
  { key: 'review_prompt_shown', category: 'device' },
  { key: 'pyqdeck:backend_origin', category: 'device' },
  { key: 'pyq_cache_migrated_rq', category: 'device' },
  { key: 'pyqdeck:sync_enabled', category: 'device' },
  { key: 'pyqdeck:sync_hint_dismissed', category: 'device' },
  // Remote app config (an admin notice, not the student's data): kept on sign-out.
  { key: 'pyqdeck:app_config', category: 'device' },
  { key: 'pyqdeck:banner_dismissed', category: 'device' },
  { key: 'pyqdeck:update_prompted', category: 'device' },
  // Journal flag: managed by the wipe itself, never wiped as data.
  { key: WIPE_PENDING_KEY, category: 'device' },

  // --- user data: wiped on sign-out ----------------------------------------
  { key: OWNER_KEY, category: 'user' },
  { key: 'pyqdeck:progress_outbox', category: 'user' },
  { key: 'pyqdeck:progress_cursor', category: 'user' },
  { key: 'pyqdeck:last_sync_at', category: 'user' },
  { key: 'pyqdeck:bg_last_run', category: 'user' },
  { key: 'pyqdeck:recent_study', category: 'user' },
  { key: 'pyqdeck:recent_notes', category: 'user' },
  { key: 'my_solution_votes_v2', category: 'user' },
  { key: 'pyq_recent_searches', category: 'user' },
  // The Ask AI engine follows the account (see settingsSync.ts), so it is user
  // data: the next person on the phone starts from the default, not this choice.
  { key: 'ask_ai_engine', category: 'user' },
  { key: 'pyqdeck:settings_pending', category: 'user' },
  { key: 'selected_syllabus_branch', category: 'user' },
  { prefix: 'pyqdeck:progress:', category: 'user' },
  { prefix: 'syllabus_done_', category: 'user' },
  { prefix: 'pyqdeck:vote:', category: 'user' },

  // --- cache: wiped on sign-out --------------------------------------------
  { prefix: 'pyq_', category: 'cache' },
];

export function categoryOf(key: string): StorageCategory | null {
  for (const e of STORAGE_REGISTRY) if ('key' in e && e.key === key) return e.category;
  for (const e of STORAGE_REGISTRY) {
    if ('prefix' in e && key.startsWith(e.prefix)) return e.category;
  }
  return null;
}

export interface WipePlan {
  /** Keys to remove. */
  remove: string[];
  /** Keys present in storage that are not in the registry (removed too). */
  unregistered: string[];
}

/** Which of the keys currently in storage a wipe should remove. */
export function planWipe(allKeys: readonly string[]): WipePlan {
  const remove: string[] = [];
  const unregistered: string[] = [];
  for (const key of allKeys) {
    if (key === WIPE_PENDING_KEY) continue;
    const category = categoryOf(key);
    if (category === 'device') continue;
    if (category === null) unregistered.push(key);
    remove.push(key);
  }
  return { remove, unregistered };
}
