import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Syllabus progress is deliberately device-local. Accounts exist now, but only
 * because voting and reporting need one - a student ticking off topics should
 * not have to sign in, so this stays local, anonymous, and never leaves the
 * device.
 */

const DONE_PREFIX = 'syllabus_done_';

/** One storage key per subject so ticking a topic rewrites a small value. */
const doneKey = (subjectId: string) => `${DONE_PREFIX}${subjectId}`;

/** Topic ids marked done for one subject. */
export async function getDoneTopics(subjectId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(doneKey(subjectId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

export async function saveDoneTopics(subjectId: string, done: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(doneKey(subjectId), JSON.stringify([...done]));
  } catch {}
}

/**
 * Counts for a list of subjects in one pass - the overview screen needs every
 * subject's progress at once, and multiGet is a single bridge crossing rather
 * than one per subject.
 */
export async function getDoneCounts(subjectIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (subjectIds.length === 0) return counts;
  try {
    const pairs = await AsyncStorage.multiGet(subjectIds.map(doneKey));
    pairs.forEach(([key, raw]) => {
      const id = key.slice(DONE_PREFIX.length);
      try {
        const parsed = raw ? JSON.parse(raw) : [];
        counts[id] = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        counts[id] = 0;
      }
    });
  } catch {
    subjectIds.forEach((id) => (counts[id] = 0));
  }
  return counts;
}

export async function clearSyllabusProgress(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(DONE_PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {}
}
