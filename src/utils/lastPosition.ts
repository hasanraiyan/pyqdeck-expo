import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The single paper/question a student was last reading, so Home can offer
 * "Continue where you left off". Device-local and anonymous, like recentStudy
 * and syllabusProgress: it never leaves the phone.
 *
 * Not `pyq_`-prefixed on purpose (same as recentStudy.ts): "Clear cache" wipes
 * every `pyq_` key, and a student's place in a paper is not cache.
 */
export interface LastPosition {
  subjectId: string;
  subjectName: string;
  semesterId?: string;
  subjectCode?: string;
  year?: number;
  questionId: string;
  qNumber?: string | number;
  updatedAt: number;
}

const LAST_POSITION_KEY = 'pyqdeck:last_position';

export async function getLastPosition(): Promise<LastPosition | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A malformed or hand-edited value counts as "no record".
    if (
      !parsed ||
      typeof parsed.subjectId !== 'string' ||
      typeof parsed.questionId !== 'string' ||
      typeof parsed.subjectName !== 'string' ||
      !parsed.subjectId ||
      !parsed.questionId
    ) {
      return null;
    }
    return parsed as LastPosition;
  } catch {
    return null;
  }
}

// Fire-and-forget: callers never await this on a tap or render path.
export async function recordLastPosition(
  item: Omit<LastPosition, 'updatedAt'>
): Promise<void> {
  try {
    if (!item.subjectId || !item.questionId || !item.subjectName) return;
    await AsyncStorage.setItem(
      LAST_POSITION_KEY,
      JSON.stringify({ ...item, updatedAt: Date.now() })
    );
  } catch (e) {
    console.warn('Failed to record last position:', e);
  }
}

export async function clearLastPosition(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_POSITION_KEY);
  } catch (e) {
    console.warn('Failed to clear last position:', e);
  }
}

/** "5 min ago", "3 h ago", "2 d ago" - short, for a card subtitle. */
export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
