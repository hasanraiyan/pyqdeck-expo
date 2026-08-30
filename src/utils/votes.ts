import AsyncStorage from '@react-native-async-storage/async-storage';

// Deliberately NOT `pyq_`-prefixed: a cache clear shouldn't make an
// already-cast vote appear unhighlighted while the server still remembers it.
// This is only a local mirror of the highlight state - the vote itself now
// lives against the user's account, so signing in elsewhere is the source of
// truth, not this.
const MY_VOTES_KEY = 'my_solution_votes';

type VoteMap = Record<string, 1 | -1>;

async function readMap(): Promise<VoteMap> {
  try {
    const raw = await AsyncStorage.getItem(MY_VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function getMyVote(questionId: string): Promise<1 | -1 | null> {
  const map = await readMap();
  return map[questionId] ?? null;
}

export async function setMyVote(questionId: string, value: 1 | -1 | 0): Promise<void> {
  try {
    const map = await readMap();
    if (value === 0) {
      delete map[questionId];
    } else {
      map[questionId] = value;
    }
    await AsyncStorage.setItem(MY_VOTES_KEY, JSON.stringify(map));
  } catch {}
}
