import AsyncStorage from '@react-native-async-storage/async-storage';

// Deliberately NOT `pyq_`-prefixed: Cache.clearAllCache() wipes every
// `pyq_`-prefixed key, and clearing downloaded content shouldn't reset who
// this device is to the vote system - that would silently let a "Clear
// cached data" tap undo the server's one-vote-per-voter dedup.
const VOTER_ID_KEY = 'anon_voter_id';

const randomId = (): string => {
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
};

let cached: string | null = null;

/**
 * A random anonymous ID, generated once and persisted, used to dedupe
 * thumbs up/down votes server-side (no user accounts exist in this app).
 */
export async function getVoterId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await AsyncStorage.getItem(VOTER_ID_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const id = randomId();
    await AsyncStorage.setItem(VOTER_ID_KEY, id);
    cached = id;
    return id;
  } catch {
    // Storage unavailable - fall back to a per-session ID so voting still
    // works, just without persistence across app restarts.
    if (!cached) cached = randomId();
    return cached;
  }
}
