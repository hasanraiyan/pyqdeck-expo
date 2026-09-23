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
  TopicNotesSearchResult,
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
import {
  FailureKind,
  MESSAGES,
  isDeviceOffline,
  isTimeoutError,
  kindForStatus,
} from '../utils/netError';

export class ApiError extends Error {
  status?: number;
  retryAfterSec?: number;
  /** Why this failed, for callers that branch rather than just render. */
  kind: FailureKind;
  /**
   * True when `message` was written for a student to read. The screens all do
   * `e?.message || 'Could not load X.'`, so an unclassified platform string
   * would always win over their own fallback - this flag is what lets
   * userMessage() tell "safe to show" from "raw platform noise".
   */
  userFacing: boolean;
  /** The original error, kept for Sentry rather than for the UI. */
  cause?: unknown;

  constructor(
    message: string,
    status?: number,
    retryAfterSec?: number,
    kind: FailureKind = 'unknown',
    cause?: unknown
  ) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
    this.kind = kind;
    this.userFacing = true;
    this.cause = cause;
    this.name = 'ApiError';
  }
}

// A request that never answers is worse than one that fails: the screen sits
// on a spinner forever. Cap it so a dead connection surfaces as a timeout.
const REQUEST_TIMEOUT_MS = 20000;

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
    const res = await fetchWithTimeout(url, init);

    if (!res.ok) {
      // 5xx means this origin is sick, so it's worth asking whether the other
      // one is healthier. 4xx deliberately is not: a 404 for a missing
      // question or a 429 from the rate limiter says nothing about the
      // origin's health, and retrying a 429 elsewhere would dodge a limit the
      // app is supposed to respect (and lose the Retry-After below).
      if (res.status >= 500 && !isRetry && (await Backend.failover())) {
        return request<T>(path, init, true);
      }

      const errData = await res.json().catch(() => ({}));
      const rawRetry = res.headers?.get?.('Retry-After');
      const retryAfterSec = rawRetry ? Number(rawRetry) : undefined;
      const kind = kindForStatus(res.status);
      // Our own backend writes messages meant for students, so prefer it.
      // res.statusText ("Bad Gateway") is not that, hence the MESSAGES map.
      throw new ApiError(
        errData.message || MESSAGES[kind],
        res.status,
        retryAfterSec,
        kind
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

    // Both origins are unreachable. Ask the OS why before blaming the server:
    // "you're offline" is actionable, "couldn't reach PYQdeck" is not.
    const kind: FailureKind = (await isDeviceOffline())
      ? 'offline'
      : isTimeoutError(err)
        ? 'timeout'
        : 'unreachable';
    throw new ApiError(MESSAGES[kind], undefined, undefined, kind, err);
  }
}

// fetch has no timeout of its own, so a half-open socket hangs the screen's
// spinner indefinitely. AbortController is used rather than
// AbortSignal.timeout for Hermes support on older Android.
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
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
  return { ...res, subjects: Array.isArray(res?.subjects) ? res.subjects.map(trimName) : [] };
};

export const listAllSubjects = async (params: { q?: string; page?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  const res = await fetchApi<SubjectsPage>(`/subjects?${qs.toString()}`);
  return { ...res, subjects: Array.isArray(res?.subjects) ? res.subjects.map(trimName) : [] };
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

// Requires a signed-in user, same as voting. The server derives the reporter
// identity from the Clerk session, so no voterId is sent.
export const reportSolution = (
  subjectId: string,
  questionId: string,
  reason: 'incorrect' | 'incomplete' | 'formatting' | 'other',
  message?: string
) =>
  postApiAuthed<{ id: string; status: string }>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/solution/report`,
    { reason, message }
  );

// Sent authed so the server can key the token to the account when the user is
// signed in - that link is what lets a "your report was fixed" push find them,
// and it now reaches every device they use rather than only the one they
// reported from. A signed-out device still registers fine (no Authorization
// header, no identity) and keeps receiving broadcasts.
export const registerPushToken = (token: string, platform: 'ios' | 'android') =>
  postApiAuthed<{ success: boolean }>('/push-token', { token, platform });



// -------------------------------------------------------------
// SYLLABUS
// -------------------------------------------------------------
// Network-first (see syllabusRead below): always try live, AsyncStorage is
// only the offline fallback. A student on a train with no signal still gets
// whatever was last fetched, however old.

const fetchAndCache = async <T,>(key: string, path: string): Promise<T> => {
  const live = await fetchApi<T>(path);
  await SylCache.write(key, live);
  return live;
};

// Network-first: the syllabus payload is lean enough (notes are fetched
// separately, on demand - see getTopicNotes below) that there's no real cost
// to always hitting the network, and it means an admin's edit shows up for
// every install - a real student's included, not just a __DEV__ bundle -
// without waiting out a cache TTL. AsyncStorage is kept purely as an offline
// fallback: a student with no signal still gets whatever was last fetched.
const syllabusRead = async <T,>(key: string, path: string): Promise<T> => {
  try {
    return await fetchAndCache(key, path);
  } catch (e) {
    const cached = await SylCache.read<T>(key);
    if (cached != null) return cached;
    throw e;
  }
};

// forceRefresh is kept on these signatures for callers (e.g. pull-to-refresh)
// but is a no-op now that syllabusRead is always network-first - it's just
// not worth touching every call site for a parameter that no longer changes
// behavior.
export const getBranches = (_forceRefresh = false) =>
  syllabusRead<Branch[]>(SylCache.branchesKey(), '/syllabus/branches');

export const getBranchSemesters = (branch: string, _forceRefresh = false) =>
  syllabusRead<BranchSemesters>(
    SylCache.semestersKey(branch),
    `/syllabus/branches/${encodeURIComponent(branch)}/semesters`
  );

export const getBranchSemester = (branch: string, semester: number, _forceRefresh = false) =>
  syllabusRead<BranchSemester>(
    SylCache.semesterKey(branch, semester),
    `/syllabus/branches/${encodeURIComponent(branch)}/semesters/${semester}`
  );

export const getSyllabusSubject = (subject: string, _forceRefresh = false) =>
  syllabusRead<SyllabusSubject>(
    SylCache.subjectKey(subject),
    `/syllabus/subjects/${encodeURIComponent(subject)}`
  );

// Deliberately not part of getSyllabusSubject's payload - a subject screen
// renders every topic in the tree at once, so bundling every topic's notes
// into that one fetch would make it slow for a subject whose notes most
// students never open. Fetched only when a topic's notes screen is opened,
// and NOT cached (unlike the rest of the syllabus) - an admin can revise a
// topic's notes at any time and a student should never be stuck reading a
// stale AsyncStorage copy.
export const getTopicNotes = (subject: string, topicId: string) =>
  fetchApi<{ id: string; title: string; notes: string }>(
    `/syllabus/subjects/${encodeURIComponent(subject)}/topics/${encodeURIComponent(topicId)}/notes`
  );

export const searchTopicNotes = (query: string, limit = 20) =>
  fetchApi<TopicNotesSearchResult>(
    `/syllabus/search/topics?q=${encodeURIComponent(query)}&limit=${limit}`
  );

