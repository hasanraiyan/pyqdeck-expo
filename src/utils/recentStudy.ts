import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RecentStudy {
  subjectId: string;
  subjectName: string;
  semesterId: string;
  subjectCode?: string;
  year?: number;
  visitedAt: number;
}

export interface RecentNote {
  topicId: string;
  topicTitle: string;
  moduleId: string;
  moduleName: string;
  subjectId: string;
  subjectName: string;
  semesterId?: string;
  subjectCode?: string;
  visitedAt: number;
}

const RECENT_STUDY_KEY = 'pyqdeck:recent_study';
const RECENT_NOTES_KEY = 'pyqdeck:recent_notes';

const MAX_RECENT_ITEMS = 4;
const MAX_RECENT_NOTES = 2;

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

export async function getRecentNotes(): Promise<RecentNote[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_NOTES_KEY);
    if (!raw) return [];
    const parsed: RecentNote[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Records a studied topic note.
 * Enforces:
 * 1. Maximum of 2 notes stored.
 * 2. Both notes must be from different chapters/modules (an entry from the same
 *    moduleId replaces previous entries from that module).
 */
export async function recordRecentNote(item: {
  topicId: string;
  topicTitle: string;
  moduleId: string;
  moduleName: string;
  subjectId: string;
  subjectName: string;
  semesterId?: string;
  subjectCode?: string;
}): Promise<void> {
  try {
    if (!item.topicId || !item.moduleId || !item.subjectId) return;
    const recents = await getRecentNotes();
    // Rule: Must be of different chapters/modules at least.
    // If a note from this chapter already exists, remove it so the new topic takes its place.
    const filtered = recents.filter((r) => r.moduleId !== item.moduleId);
    const updated: RecentNote[] = [
      {
        topicId: item.topicId,
        topicTitle: item.topicTitle,
        moduleId: item.moduleId,
        moduleName: item.moduleName,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        semesterId: item.semesterId,
        subjectCode: item.subjectCode,
        visitedAt: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_RECENT_NOTES);

    await AsyncStorage.setItem(RECENT_NOTES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to record recent note:', e);
  }
}

export async function clearRecentNotes(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_NOTES_KEY);
  } catch (e) {
    console.warn('Failed to clear recent notes:', e);
  }
}

