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
import {
  Branch,
  BranchSemesters,
  BranchSemester,
  SyllabusSubject,
} from '../types/syllabus';
import * as Cache from '../db/cacheService';
import * as SylCache from '../db/syllabusCache';
import * as Backend from './backend';
import { authHeader } from '../auth/token';

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

// Every request resolves its origin at call time instead of closing over a
// constant, which is what lets a failover move the whole app between
// deployments without an APK update.
async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  await Backend.ready();
  const url = `${Backend.getApiBaseUrl()}${path}`;

  try {
    const res = await fetch(url, init);

    if (!res.ok) {
      // 5xx means this origin is sick, so it's worth asking whether the other
      // one is healthier. 4xx deliberately is not: a 404 for a missing
      // question or a 429 from the rate limiter says nothing about the
      // origin's health, and retrying a 429 elsewhere would dodge a limit the
      // app is supposed to respect (and lose the Retry-After below).
      if (res.status >= 500 && !isRetry && (await Backend.failover())) {
        return request<T>(path, init, true);
      }

      const errData = await res.json().catch(() => ({ message: res.statusText }));
      const rawRetry = res.headers?.get?.('Retry-After');
      const retryAfterSec = rawRetry ? Number(rawRetry) : undefined;
      throw new ApiError(
        errData.message || `Request failed with status ${res.status}`,
        res.status,
        retryAfterSec
      );
    }

    return await res.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;

    // Transport-level failure (DNS, refused, timeout) - the classic sign the
    // origin is gone rather than unhappy. isRetry caps this at one extra
    // attempt, so a genuinely offline device fails fast into the SQLite cache
    // the callers below fall back on, instead of ping-ponging between origins.
    if (!isRetry && (await Backend.failover())) {
      return request<T>(path, init, true);
    }
    throw new ApiError(err.message || 'Network error occurred');
  }
}

const fetchApi = <T,>(path: string): Promise<T> => request<T>(path);

const postApi = <T,>(path: string, body: unknown): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// POST with the Clerk session token attached. Only for endpoints the server
// gates behind requireSignIn - everything else deliberately stays anonymous.
// Sends no Authorization header at all when signed out, so the server answers
// with its own 401 rather than the client inventing one.
const postApiAuthed = async <T,>(path: string, body: unknown): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });

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

// Requires a signed-in user. The server derives the voter identity from the
// Clerk session, so no voterId is sent - passing one would be ignored.
export const voteSolution = (subjectId: string, questionId: string, value: 1 | -1 | 0) =>
  postApiAuthed<{ upvotes: number; downvotes: number }>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/solution/vote`,
    { value }
  );

export const reportSolution = (
  subjectId: string,
  questionId: string,
  voterId: string,
  reason: 'incorrect' | 'incomplete' | 'formatting' | 'other',
  message?: string
) =>
  postApi<{ id: string; status: string }>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/solution/report`,
    { voterId, reason, message }
  );

export const registerPushToken = (token: string, platform: 'ios' | 'android', voterId?: string) =>
  postApi<{ success: boolean }>('/push-token', { token, platform, voterId });



// -------------------------------------------------------------
// SYLLABUS
// -------------------------------------------------------------
// Same cache-first shape as the archive endpoints above: serve a fresh cache
// without touching the network, otherwise fetch and re-cache, and on any
// failure fall back to whatever is cached however old it is. A student on a
// train with no signal still gets their syllabus.

/**
 * Whether a cached value is worth serving without a network check. An empty
 * array is truthy but is NOT content: it usually means the data was typed into
 * the database after the last fetch, and serving it as fresh would hide the new
 * rows for the whole TTL. Wrapper objects (branch-semesters, a semester's
 * subjects) get the same rule - an empty list inside is treated as "nothing
 * here yet". Such values still work as an offline fallback in the catch below,
 * just never as a reason to skip the network.
 */
const hasContent = (value: unknown): boolean => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    const any = value as Record<string, unknown>;
    if (Array.isArray(any.semesters)) return any.semesters.length > 0;
    if (Array.isArray(any.subjects)) return any.subjects.length > 0;
    if (Array.isArray(any.modules)) return any.modules.length > 0;
    return true;
  }
  return true;
};

const fetchAndCache = async <T,>(key: string, path: string): Promise<T> => {
  const live = await fetchApi<T>(path);
  await SylCache.write(key, live);
  return live;
};

const syllabusRead = async <T,>(
  key: string,
  path: string,
  forceRefresh = false
): Promise<T> => {
  const cached = await SylCache.read<T>(key);

  // A cache entry is only a reason to skip the network when it actually holds
  // content - see hasContent above.
  if (cached != null && hasContent(cached) && !forceRefresh) {
    if (await SylCache.isFresh(key)) return cached;
    // Stale but present: show it now, refresh behind it. A screen a day old is
    // better than a spinner for a round-trip, and the background fetch fills
    // the cache for next time. This is what makes the syllabus feel instant
    // once a branch has been opened at all.
    void fetchAndCache(key, path).catch(() => {});
    return cached;
  }

  try {
    return await fetchAndCache(key, path);
  } catch (e) {
    if (cached != null) return cached;
    throw e;
  }
};

export const getBranches = (forceRefresh = false) =>
  syllabusRead<Branch[]>(SylCache.branchesKey(), '/syllabus/branches', forceRefresh);

export const getBranchSemesters = (branch: string, forceRefresh = false) =>
  syllabusRead<BranchSemesters>(
    SylCache.semestersKey(branch),
    `/syllabus/branches/${encodeURIComponent(branch)}/semesters`,
    forceRefresh
  );

export const getBranchSemester = (branch: string, semester: number, forceRefresh = false) =>
  syllabusRead<BranchSemester>(
    SylCache.semesterKey(branch, semester),
    `/syllabus/branches/${encodeURIComponent(branch)}/semesters/${semester}`,
    forceRefresh
  );

export const getSyllabusSubject = (subject: string, forceRefresh = false) =>
  syllabusRead<SyllabusSubject>(
    SylCache.subjectKey(subject),
    `/syllabus/subjects/${encodeURIComponent(subject)}`,
    forceRefresh
  );
