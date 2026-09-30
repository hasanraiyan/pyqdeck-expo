import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  Semester,
  SubjectSummary,
  SubjectMeta,
  QuestionSummary,
  Solution,
} from '../types';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 Hours

// questionId is only unique per subject ("Q6" exists in every subject), so
// per-question and solution keys MUST carry the subject id. Keep the `pyq_`
// prefix so clearAllCache() still sweeps them.
const solutionKey = (subjectId: string, questionId: string) =>
  `pyq_v2_solution_${subjectId}_${questionId}`;
const questionKey = (subjectId: string, questionId: string) =>
  `pyq_v2_question_${subjectId}_${questionId}`;
const QUESTION_KEY_PREFIX = 'pyq_v2_question_';

/**
 * Generate a deterministic fingerprint hash for a subject's metadata
 */
export function generateSubjectHash(meta: SubjectMeta): string {
  const totalQuestions = meta.years.reduce((acc, y) => acc + y.questionCount, 0);
  const yearsSig = meta.years.map((y) => `${y.year}:${y.questionCount}`).join(',');
  const chaptersSig = meta.chapters.map((c) => `${c.chapter}:${c.questionCount}`).join(',');
  return `${meta.id}_q${totalQuestions}_y[${yearsSig}]_c[${chaptersSig}]`;
}

export function getQueryCacheKey(
  subjectId: string,
  params: { year?: number; chapter?: string } = {}
): string {
  const y = params.year !== undefined ? String(params.year) : 'all';
  const c = params.chapter ? params.chapter.trim().toLowerCase() : 'all';
  return `questions_${subjectId}_y[${y}]_c[${c}]`;
}

// -------------------------------------------------------------
// CACHE METADATA
// -------------------------------------------------------------

export async function isSubjectCacheFresh(cacheKey: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(`pyq_cm_${cacheKey}`);
    if (!raw) return false;
    const meta = JSON.parse(raw);
    return Date.now() - (meta.last_checked || 0) < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

export async function getCachedSubjectHash(subjectId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(`pyq_cm_subject_meta_${subjectId}`);
    if (!raw) return null;
    const meta = JSON.parse(raw);
    return meta.hash || null;
  } catch {
    return null;
  }
}

export async function updateSubjectCacheMeta(cacheKey: string, hash: string) {
  try {
    const now = Date.now();
    await AsyncStorage.setItem(
      `pyq_cm_${cacheKey}`,
      JSON.stringify({ key: cacheKey, hash, last_checked: now, updated_at: now })
    );
  } catch (e) {
    console.error('Failed to update cache meta:', e);
  }
}

// -------------------------------------------------------------
// SEMESTERS & SUBJECTS
// -------------------------------------------------------------

export async function getCachedSemesters(): Promise<Semester[] | null> {
  try {
    const raw = await AsyncStorage.getItem('pyq_semesters');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveCachedSemesters(semesters: Semester[]) {
  try {
    await AsyncStorage.setItem('pyq_semesters', JSON.stringify(semesters));
  } catch (e) {
    console.error('Failed to save semesters cache:', e);
  }
}

export async function getCachedSubjects(semesterId: string): Promise<SubjectSummary[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`pyq_subjects_${semesterId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveCachedSubjects(semesterId: string, subjects: SubjectSummary[]) {
  try {
    await AsyncStorage.setItem(`pyq_subjects_${semesterId}`, JSON.stringify(subjects));
  } catch (e) {
    console.error('Failed to save subjects cache:', e);
  }
}

// -------------------------------------------------------------
// SUBJECT METADATA
// -------------------------------------------------------------

export async function getCachedSubjectMeta(subjectId: string): Promise<SubjectMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(`pyq_meta_${subjectId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveCachedSubjectMeta(subjectId: string, meta: SubjectMeta) {
  try {
    await AsyncStorage.setItem(`pyq_meta_${subjectId}`, JSON.stringify(meta));
  } catch (e) {
    console.error('Failed to save subject meta cache:', e);
  }
}

// -------------------------------------------------------------
// QUESTIONS
// -------------------------------------------------------------

export async function getCachedQuestions(
  subjectId: string,
  params: { year?: number; chapter?: string } = {}
): Promise<QuestionSummary[] | null> {
  try {
    const key = `pyq_q_${getQueryCacheKey(subjectId, params)}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw) return JSON.parse(raw);

    // Fallback: Check if all questions for this subject are cached
    const allKey = `pyq_q_${getQueryCacheKey(subjectId, {})}`;
    const allRaw = await AsyncStorage.getItem(allKey);
    if (allRaw) {
      const all: QuestionSummary[] = JSON.parse(allRaw);
      let filtered = all;
      if (params.year !== undefined) {
        filtered = filtered.filter((q) => q.year === params.year);
      }
      if (params.chapter) {
        filtered = filtered.filter(
          (q) => q.chapter?.trim().toLowerCase() === params.chapter?.trim().toLowerCase()
        );
      }
      return filtered;
    }

    return null;
  } catch {
    return null;
  }
}

export async function saveCachedQuestions(
  subjectId: string,
  questions: QuestionSummary[],
  params: { year?: number; chapter?: string } = {}
) {
  try {
    const key = `pyq_q_${getQueryCacheKey(subjectId, params)}`;
    await AsyncStorage.setItem(key, JSON.stringify(questions));

    // Also cache individual questions for fast detail lookup
    for (const q of questions) {
      if (q.questionId) {
        await AsyncStorage.setItem(questionKey(subjectId, q.questionId), JSON.stringify(q));
      }
    }
  } catch (e) {
    console.error('Failed to save cached questions:', e);
  }
}

export async function getCachedQuestion(
  subjectId: string,
  questionId: string
): Promise<QuestionSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(questionKey(subjectId, questionId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// SOLUTIONS
// -------------------------------------------------------------

export async function getCachedSolution(
  subjectId: string,
  questionId: string
): Promise<Solution | null> {
  try {
    const raw = await AsyncStorage.getItem(solutionKey(subjectId, questionId));
    if (!raw) return null;
    const solution: Solution = JSON.parse(raw);
    // Defensive: never serve a payload that belongs to a different question.
    return solution?.questionId === questionId ? solution : null;
  } catch {
    return null;
  }
}

export async function saveCachedSolution(subjectId: string, solution: Solution) {
  try {
    if (solution && solution.questionId) {
      await AsyncStorage.setItem(
        solutionKey(subjectId, solution.questionId),
        JSON.stringify(solution)
      );
    }
  } catch (e) {
    console.error('Failed to save cached solution:', e);
  }
}

// -------------------------------------------------------------
// OFFLINE SEARCH FALLBACK
// -------------------------------------------------------------

export async function searchOfflineQuestions(query: string): Promise<QuestionSummary[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const qKeys = keys.filter((k) => k.startsWith(QUESTION_KEY_PREFIX));
    if (qKeys.length === 0) return [];

    const rawValues = await Promise.all(qKeys.map((k) => AsyncStorage.getItem(k)));
    const questions: QuestionSummary[] = [];
    const qTerm = query.toLowerCase().trim();

    for (const val of rawValues) {
      if (val) {
        const q: QuestionSummary = JSON.parse(val);
        const subjectName = (q as any).subject?.name || '';
        if (
          (q.text && q.text.toLowerCase().includes(qTerm)) ||
          (q.chapter && q.chapter.toLowerCase().includes(qTerm)) ||
          (subjectName && subjectName.toLowerCase().includes(qTerm))
        ) {
          questions.push(q);
        }
      }
    }

    return questions.slice(0, 20);
  } catch {
    return [];
  }
}

export const searchLocalCache = async (query: string) => {
  const questions = await searchOfflineQuestions(query);
  return {
    subjects: [] as SubjectSummary[],
    questions,
  };
};

// -------------------------------------------------------------
// CACHE CLEARING
// -------------------------------------------------------------

/**
 * Wipes all cached content (semesters, subjects, questions, solutions,
 * recent searches) - every cache key in this app is prefixed `pyq_`, which
 * also covers the syllabus cache (pyq_syl_* / pyq_cm_syl_*).
 * Leaves behavioral/preference keys (volume_scroll_*, interstitial_*,
 * review_prompt_*) untouched.
 *
 * On web AsyncStorage IS localStorage, but the driver's getAllKeys can miss
 * keys its own getItem never stored, so sweep localStorage directly too -
 * otherwise a web session keeps serving stale caches after "Clear" says done.
 */
export async function clearAllCache(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      const storage = (globalThis as any).localStorage;
      if (storage) {
        Object.keys(storage)
          .filter((k) => k.startsWith('pyq_'))
          .forEach((k) => storage.removeItem(k));
      }
    } catch {}
  }

  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith('pyq_'));
  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
}

// -------------------------------------------------------------
// MIGRATIONS
// -------------------------------------------------------------

const MIGRATION_V2_FLAG = 'pyq_cache_migrated_v2';

/**
 * One-time cleanup of entries written before keys were subject-scoped
 * (`pyq_solution_<qid>`, `pyq_question_<qid>`, `my_solution_votes`). Those
 * carry no subject id so they can't be re-keyed - some are already poisoned
 * with another subject's data. Safe to re-run; the flag makes it a no-op.
 */
export async function migrateSubjectScopedKeys(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(MIGRATION_V2_FLAG)) return;
    const keys = await AsyncStorage.getAllKeys();
    const legacy = keys.filter(
      (k) =>
        k.startsWith('pyq_solution_') ||
        k.startsWith('pyq_question_') ||
        k === 'my_solution_votes'
    );
    if (legacy.length > 0) await AsyncStorage.multiRemove(legacy);
    await AsyncStorage.setItem(MIGRATION_V2_FLAG, '1');
  } catch (e) {
    console.error('Cache migration failed:', e);
  }
}
