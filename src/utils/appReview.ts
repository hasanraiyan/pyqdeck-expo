import * as StoreReview from 'expo-store-review';
import { getDatabase } from '../db';

const OPENS_KEY = 'review_prompt_opens';
const PROMPTED_KEY = 'review_prompt_shown';
// Ask once the user has opened the app a handful of times - enough to have seen
// real value, not on a first run. The OS itself rate-limits how often the native
// sheet actually shows, this just avoids calling it needlessly on every launch.
const OPENS_BEFORE_PROMPT = 5;

async function getState(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_state WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

async function setState(key: string, value: string) {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

/**
 * Call once per cold app launch. Bumps the open counter and, the first time it
 * crosses the threshold, requests the native App Store / Play Store review sheet.
 */
export async function maybeRequestReview() {
  try {
    const alreadyPrompted = await getState(PROMPTED_KEY);
    if (alreadyPrompted === '1') return;

    const opens = Number((await getState(OPENS_KEY)) ?? '0') + 1;
    await setState(OPENS_KEY, String(opens));

    if (opens < OPENS_BEFORE_PROMPT) return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    await setState(PROMPTED_KEY, '1');
    await StoreReview.requestReview();
  } catch {
    // Never let a review prompt failure affect app startup.
  }
}
