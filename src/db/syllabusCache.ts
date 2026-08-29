import AsyncStorage from '@react-native-async-storage/async-storage';
import { Branch, BranchSemesters, BranchSemester, SyllabusSubject } from '../types/syllabus';

/**
 * Read-through cache for the syllabus endpoints, in the same shape as
 * cacheService.ts: values under a `pyq_` key so clearAllCache() sweeps them
 * up, and freshness tracked separately under `pyq_cm_` so a stale-but-present
 * value can still be served when the network is gone.
 *
 * The TTL is a day rather than the archive's twelve hours - a syllabus changes
 * when the university revises a scheme, which is once or twice a year.
 */

const TTL_MS = 24 * 60 * 60 * 1000;

const valueKey = (key: string) => `pyq_syl_${key}`;
const metaKey = (key: string) => `pyq_cm_syl_${key}`;

export async function isFresh(key: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(metaKey(key));
    if (!raw) return false;
    const meta = JSON.parse(raw);
    return Date.now() - (meta.last_checked || 0) < TTL_MS;
  } catch {
    return false;
  }
}

export async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(valueKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function write<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(valueKey(key), JSON.stringify(value));
    await AsyncStorage.setItem(metaKey(key), JSON.stringify({ last_checked: Date.now() }));
  } catch {
    // A cache write failing is not worth surfacing - the value was already
    // returned to the caller from the network.
  }
}

// Key builders, kept here so a screen and the cache can never disagree on
// what a given request is called.
export const branchesKey = () => 'branches';
export const semestersKey = (branch: string) => `sems_${branch}`;
export const semesterKey = (branch: string, semester: number) => `sem_${branch}_${semester}`;
export const subjectKey = (subject: string) => `subject_${subject}`;

export type CachedBranches = Branch[];
export type CachedSemesters = BranchSemesters;
export type CachedSemester = BranchSemester;
export type CachedSubject = SyllabusSubject;
