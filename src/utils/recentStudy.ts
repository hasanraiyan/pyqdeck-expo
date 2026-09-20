import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RecentStudy {
  subjectId: string;
  subjectName: string;
  semesterId: string;
  subjectCode?: string;
  year?: number;
  visitedAt: number;
}

const RECENT_STUDY_KEY = 'pyqdeck:recent_study';
const MAX_RECENT_ITEMS = 4;

export async function getRecentStudies(): Promise<RecentStudy[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_STUDY_KEY);
    if (!raw) return [];
    const parsed: RecentStudy[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordRecentStudy(item: {
  subjectId: string;
  subjectName: string;
  semesterId: string;
  subjectCode?: string;
  year?: number;
}): Promise<void> {
  try {
    if (!item.subjectId || !item.subjectName) return;
    const recents = await getRecentStudies();
    // Filter out previous entry for the same subject so it moves to top
    const filtered = recents.filter((r) => r.subjectId !== item.subjectId);
    const updated: RecentStudy[] = [
      {
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        semesterId: item.semesterId,
        subjectCode: item.subjectCode,
        year: item.year,
        visitedAt: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_RECENT_ITEMS);

    await AsyncStorage.setItem(RECENT_STUDY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to record recent study:', e);
  }
}

export async function clearRecentStudies(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_STUDY_KEY);
  } catch (e) {
    console.warn('Failed to clear recent studies:', e);
  }
}
