import AsyncStorage from '@react-native-async-storage/async-storage';

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
