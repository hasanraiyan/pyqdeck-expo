import {
  Semester,
  SubjectSummary,
  SubjectMeta,
  QuestionListResult,
  QuestionSummary,
  Solution,
  SubjectSearchResult,
  SubjectsPage,
  AllQuestionsSearchResult,
  SimilarQuestionsResult,
  RepeatedQuestionsResult,
} from '../types';
import * as Cache from '../db/cacheService';

export const API_BASE_URL = 'https://api.pyqdeck.in/api/public';

export class ApiError extends Error {
  status?: number;
  retryAfterSec?: number;
  constructor(message: string, status?: number, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
    this.name = 'ApiError';
  }
}

// Backend subject names occasionally carry stray leading/trailing whitespace,
// which breaks alphabetical sorting and looks wrong wherever it's rendered.
function trimName<T extends { name: string }>(item: T): T {
  return item.name === item.name.trim() ? item : { ...item, name: item.name.trim() };
}

async function fetchApi<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: res.statusText }));
      const rawRetry = res.headers?.get?.('Retry-After');
      const retryAfterSec = rawRetry ? Number(rawRetry) : undefined;
      throw new ApiError(errData.message || `Request failed with status ${res.status}`, res.status, retryAfterSec);
    }
    return await res.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network error occurred');
  }
}

async function postApi<T>(path: string, body: unknown): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: res.statusText }));
      const rawRetry = res.headers?.get?.('Retry-After');
      const retryAfterSec = rawRetry ? Number(rawRetry) : undefined;
      throw new ApiError(errData.message || `Request failed with status ${res.status}`, res.status, retryAfterSec);
    }
    return await res.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network error occurred');
  }
}

// -------------------------------------------------------------
// CACHE-FIRST API ENDPOINTS WITH SILENT BACKGROUND REVALIDATION
// -------------------------------------------------------------

const SEMESTERS_CACHE_KEY = 'semesters';

export const getSemesters = async (forceRefresh = false): Promise<Semester[]> => {
  const cached = await Cache.getCachedSemesters();
  const isFresh = !forceRefresh && (await Cache.isSubjectCacheFresh(SEMESTERS_CACHE_KEY));

  // Semester list barely changes - skip the network entirely while cache is fresh.
  if (cached && cached.length > 0 && isFresh) {
    return cached;
  }

  try {
    const live = await fetchApi<Semester[]>('/semesters');
    Cache.saveCachedSemesters(live);
    await Cache.updateSubjectCacheMeta(SEMESTERS_CACHE_KEY, `count_${live.length}`);
    return live;
  } catch (e) {
    if (cached && cached.length > 0) return cached;
    throw e;
  }
};

export const getSubjects = async (
  semesterId: string,
  forceRefresh = false
): Promise<SubjectSummary[]> => {
  const cacheKey = `subjects_${semesterId}`;
  const cached = await Cache.getCachedSubjects(semesterId);
  const isFresh = !forceRefresh && (await Cache.isSubjectCacheFresh(cacheKey));

  if (cached && cached.length > 0 && isFresh) {
    return cached.map(trimName);
  }

  try {
    const live = await fetchApi<SubjectSummary[]>(`/semesters/${semesterId}/subjects`);
    Cache.saveCachedSubjects(semesterId, live);
    await Cache.updateSubjectCacheMeta(cacheKey, `count_${live.length}`);
    return live.map(trimName);
  } catch (e) {
    if (cached && cached.length > 0) return cached.map(trimName);
    throw e;
  }
};

/**
 * Fetch Subject Meta with 12h hash comparison
 */
export const getSubjectMeta = async (
  subjectId: string,
  forceRefresh = false
): Promise<SubjectMeta> => {
  // 1. Try local cache first
  const cachedMeta = await Cache.getCachedSubjectMeta(subjectId);
  const isFresh = !forceRefresh && (await Cache.isSubjectCacheFresh(subjectId));

  // If cached and fresh (within 12 hours), return immediately
  if (cachedMeta && isFresh) {
    return trimName(cachedMeta);
  }

  try {
    const liveMeta = await fetchApi<SubjectMeta>(`/subjects/${subjectId}/meta`);
    const newHash = Cache.generateSubjectHash(liveMeta);
    await Cache.saveCachedSubjectMeta(subjectId, liveMeta);
    await Cache.updateSubjectCacheMeta(subjectId, newHash);
    return trimName(liveMeta);
  } catch (e) {
    if (cachedMeta) return trimName(cachedMeta);
    throw e;
  }
};

/**
 * Fetch Questions with local SQLite retrieval & background refresh
 */
export const getQuestions = async (
  subjectId: string,
  params: { year?: number; chapter?: string; search?: string; limit?: number; offset?: number } = {},
  forceRefresh = false
): Promise<QuestionListResult> => {
  const queryKey = Cache.getQueryCacheKey(subjectId, {
    year: params.year,
    chapter: params.chapter,
  });

  // 1. Read local SQLite cache
  const cachedQuestions = await Cache.getCachedQuestions(subjectId, {
    year: params.year,
    chapter: params.chapter,
  });

  const cachedMeta = await Cache.getCachedSubjectMeta(subjectId);
  // Check if THIS SPECIFIC query (e.g. Module 1 across all years) was previously fetched & fresh
  const isQueryFresh = !forceRefresh && (await Cache.isSubjectCacheFresh(queryKey));

  // If we already have fresh cached data for this exact query, return immediately
  if (cachedQuestions && cachedQuestions.length > 0 && isQueryFresh) {
    return {
      subject: { id: subjectId, name: cachedMeta?.name || '' },
      total: cachedQuestions.length,
      returned: cachedQuestions.length,
      offset: 0,
      questions: cachedQuestions,
    };
  }

  // 2. Fetch full question set for this query from API
  try {
    const qs = new URLSearchParams();
    if (params.year !== undefined) qs.set('year', String(params.year));
    if (params.chapter) qs.set('chapter', params.chapter);
    if (params.search) qs.set('search', params.search);
    qs.set('limit', String(params.limit ?? 50));
    if (params.offset) qs.set('offset', String(params.offset));

    const liveResult = await fetchApi<QuestionListResult>(`/subjects/${subjectId}/questions?${qs.toString()}`);
    if (liveResult && liveResult.questions) {
      await Cache.saveCachedQuestions(subjectId, liveResult.questions);
      // Mark THIS query as fresh
      await Cache.updateSubjectCacheMeta(queryKey, `count_${liveResult.questions.length}`);
    }
    return liveResult;
  } catch (e) {
    // If network fails (offline), return whatever questions we have in SQLite for this filter.
    if (cachedQuestions && cachedQuestions.length > 0) {
      return {
        subject: { id: subjectId, name: cachedMeta?.name || '' },
        total: cachedQuestions.length,
        returned: cachedQuestions.length,
        offset: 0,
        questions: cachedQuestions,
      };
    }
    throw e;
  }
};

export const getQuestion = (subjectId: string, questionId: string) =>
  fetchApi<QuestionListResult>(`/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}`);

export const getSolution = async (subjectId: string, questionId: string): Promise<Solution> => {
  // 1. Check local solution cache
  const cached = await Cache.getCachedSolution(questionId);
  if (cached) return cached;

  try {
    const live = await fetchApi<Solution>(
      `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/solution`
    );
    if (live) {
      Cache.saveCachedSolution(subjectId, live);
    }
    return live;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
};

export const searchSubjects = async (query: string, limit = 20) => {
  const res = await fetchApi<SubjectSearchResult>(`/subjects/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  return { ...res, subjects: res.subjects.map(trimName) };
};

export const listAllSubjects = async (params: { q?: string; page?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  const res = await fetchApi<SubjectsPage>(`/subjects?${qs.toString()}`);
  return { ...res, subjects: res.subjects.map(trimName) };
};

export const searchAllQuestions = (query: string, limit = 20) =>
  fetchApi<AllQuestionsSearchResult>(`/questions/semantic-search?q=${encodeURIComponent(query)}&limit=${limit}`);

export const getSimilarQuestions = (subjectId: string, questionId: string, limit = 5) =>
  fetchApi<SimilarQuestionsResult>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/similar?limit=${limit}`
  );

export const getRepeatedQuestions = (subjectId: string, questionId: string, limit = 5) =>
  fetchApi<RepeatedQuestionsResult>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/repeats?limit=${limit}`
  );

export const voteSolution = (
  subjectId: string,
  questionId: string,
  voterId: string,
  value: 1 | -1 | 0
) =>
  postApi<{ upvotes: number; downvotes: number }>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/solution/vote`,
    { voterId, value }
  );

export const registerPushToken = (token: string, platform: 'ios' | 'android') =>
  postApi<{ success: boolean }>('/push-token', { token, platform });


