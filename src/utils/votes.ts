import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerWipeHook } from '../auth/wipeUserData';

// Deliberately NOT `pyq_`-prefixed: a cache clear shouldn't make an
// already-cast vote appear unhighlighted while the server still remembers it.
// This is only a local mirror of the highlight state - the vote itself now
// lives against the user's account, so signing in elsewhere is the source of
// truth, not this.
//
// One AsyncStorage key per vote, `pyqdeck:vote:${subjectId}:${questionId}` -
// questionId alone repeats across subjects. The legacy single JSON map
// (`my_solution_votes_v2`) is exploded into per-vote keys on first use. The legacy un-scoped `my_solution_votes` key is removed by
// Cache.migrateSubjectScopedKeys().
const LEGACY_MAP_KEY = 'my_solution_votes_v2';
const VOTE_PREFIX = 'pyqdeck:vote:';
const voteKey = (subjectId: string, questionId: string) =>
  `${VOTE_PREFIX}${subjectId}:${questionId}`;

let migration: Promise<void> | null = null;

// Idempotent: the legacy key is removed only after its votes are written, so a
// failure mid-way just retries next launch. Runs at most once per session.
function migrateLegacyVotes(): Promise<void> {
  migration ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(LEGACY_MAP_KEY);
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, 1 | -1>;
      const pairs: [string, string][] = Object.entries(map)
        .filter(([, v]) => v === 1 || v === -1)
        .map(([k, v]) => [`${VOTE_PREFIX}${k}`, String(v)]);
      if (pairs.length) await AsyncStorage.multiSet(pairs);
      await AsyncStorage.removeItem(LEGACY_MAP_KEY);
    } catch {
      migration = null; // retry on next call
    }
  })();
  return migration;
}

export async function getMyVote(subjectId: string, questionId: string): Promise<1 | -1 | null> {
  try {
    await migrateLegacyVotes();
    const raw = await AsyncStorage.getItem(voteKey(subjectId, questionId));
    return raw === '1' ? 1 : raw === '-1' ? -1 : null;
  } catch {
    return null;
  }
}

export async function setMyVote(subjectId: string, questionId: string, value: 1 | -1 | 0): Promise<void> {
  try {
    await migrateLegacyVotes();
    if (value === 0) {
      await AsyncStorage.removeItem(voteKey(subjectId, questionId));
    } else {
      await AsyncStorage.setItem(voteKey(subjectId, questionId), String(value));
    }
  } catch {}
}

// Subjects whose highlights were already restored from the account this
// session, so opening many questions does not refetch. Cleared by the sign-out
// wipe so the next account starts fresh.
const restoredSubjects = new Set<string>();
registerWipeHook(() => restoredSubjects.clear());

export const votesRestored = (subjectId: string) => restoredSubjects.has(subjectId);

/**
 * Makes this device's vote highlights for one subject match the account's.
 * The local keys are only a mirror: the account (server) is the truth, so a
 * new phone shows the right highlights and a vote withdrawn elsewhere
 * disappears here. Returns true when it changed anything.
 */
export async function restoreVotesForSubject(
  subjectId: string,
  accountVotes: { questionId: string | null; value: 1 | -1 }[]
): Promise<boolean> {
  if (restoredSubjects.has(subjectId)) return false;
  try {
    await migrateLegacyVotes();
    const prefix = `${VOTE_PREFIX}${subjectId}:`;
    const wanted = new Map<string, string>();
    for (const v of accountVotes) {
      if (v.questionId) wanted.set(voteKey(subjectId, v.questionId), String(v.value));
    }
    const existingKeys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
    const current = new Map(await AsyncStorage.multiGet(existingKeys));
    const stale = existingKeys.filter((k) => !wanted.has(k));
    const changed = [...wanted].filter(([k, v]) => current.get(k) !== v);
    if (stale.length) await AsyncStorage.multiRemove(stale);
    if (changed.length) await AsyncStorage.multiSet(changed);
    restoredSubjects.add(subjectId);
    return stale.length > 0 || changed.length > 0;
  } catch {
    return false;
  }
}
