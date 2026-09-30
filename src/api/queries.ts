import { infiniteQueryOptions, queryOptions, useQuery } from '@tanstack/react-query';
import {
  getSemesters,
  getSubjects,
  getSubjectMeta,
  getQuestions,
  getQuestion,
  getSolution,
  getSimilarQuestions,
  getRepeatedQuestions,
  getBranches,
  getBranchSemesters,
  getBranchSemester,
  getSyllabusSubject,
  searchSubjects,
  searchAllQuestions,
  searchTopicNotes,
  getAiOverview,
  getAiOverviewStatus,
  listAllSubjects,
  getTopicNotes,
} from './index';
import type { QueryClient } from '@tanstack/react-query';
import { qk, QuestionParams } from './queryKeys';
import { persistMeta, STALE } from './queryClient';

// Query definitions (key + fetcher + freshness + persistence) live here so the
// hooks below and any imperative queryClient.fetchQuery/prefetchQuery call
// share exactly one definition per request.

export const semestersQuery = () =>
  queryOptions({ queryKey: qk.semesters(), queryFn: ({ signal }) => getSemesters(signal), meta: persistMeta });

export const subjectsQuery = (semesterId: string) =>
  queryOptions({
    queryKey: qk.subjects(semesterId),
    queryFn: ({ signal }) => getSubjects(semesterId, signal),
    meta: persistMeta,
  });

export const subjectMetaQuery = (subjectId: string) =>
  queryOptions({
    queryKey: qk.subjectMeta(subjectId),
    queryFn: ({ signal }) => getSubjectMeta(subjectId, signal),
    meta: persistMeta,
  });

export const questionsQuery = (subjectId: string, params: QuestionParams = {}) =>
  queryOptions({
    queryKey: qk.questions(subjectId, params),
    queryFn: ({ signal }) => getQuestions(subjectId, params, signal),
    meta: persistMeta,
  });

export const questionQuery = (subjectId: string, questionId: string) =>
  queryOptions({
    queryKey: qk.question(subjectId, questionId),
    queryFn: ({ signal }) => getQuestion(subjectId, questionId, signal),
    meta: persistMeta,
  });

export const solutionQuery = (subjectId: string, questionId: string) =>
  queryOptions({
    queryKey: qk.solution(subjectId, questionId),
    queryFn: ({ signal }) => getSolution(subjectId, questionId, signal),
    meta: persistMeta,
  });

export const similarQuery = (subjectId: string, questionId: string, limit = 5) =>
  queryOptions({
    queryKey: qk.similar(subjectId, questionId, limit),
    queryFn: ({ signal }) => getSimilarQuestions(subjectId, questionId, limit, signal),
    staleTime: STALE.volatile,
    gcTime: STALE.volatile,
  });

export const repeatsQuery = (subjectId: string, questionId: string, limit = 5) =>
  queryOptions({
    queryKey: qk.repeats(subjectId, questionId, limit),
    queryFn: ({ signal }) => getRepeatedQuestions(subjectId, questionId, limit, signal),
    staleTime: STALE.volatile,
    gcTime: STALE.volatile,
  });

// Syllabus: staleTime 0 = network-first on every mount; the persisted copy is
// the offline fallback (React Query keeps the last data when a refetch fails).
export const syllabusBranchesQuery = () =>
  queryOptions({
    queryKey: qk.syllabusBranches(),
    queryFn: ({ signal }) => getBranches(signal),
    staleTime: STALE.syllabus,
    meta: persistMeta,
  });

export const syllabusSemestersQuery = (branch: string) =>
  queryOptions({
    queryKey: qk.syllabusSemesters(branch),
    queryFn: ({ signal }) => getBranchSemesters(branch, signal),
    staleTime: STALE.syllabus,
    meta: persistMeta,
  });

export const syllabusSemesterQuery = (branch: string, semester: number) =>
  queryOptions({
    queryKey: qk.syllabusSemester(branch, semester),
    queryFn: ({ signal }) => getBranchSemester(branch, semester, signal),
    staleTime: STALE.syllabus,
    meta: persistMeta,
  });

export const syllabusSubjectQuery = (subject: string) =>
  queryOptions({
    queryKey: qk.syllabusSubject(subject),
    queryFn: ({ signal }) => getSyllabusSubject(subject, signal),
    staleTime: STALE.syllabus,
    meta: persistMeta,
  });

// -------------------------------------------------------------
// Search, all-subjects and topic notes
// -------------------------------------------------------------
// None of these opt in to persistence (no `persistMeta`): they are short-lived
// interactions, and keeping them out of the on-disk cache keeps that cache
// small. They still get de-duplication, cancellation (each fetcher forwards
// React Query's signal) and a short in-memory reuse window.

export const SEARCH_STALE = 5 * 60 * 1000;
const SEARCH_GC = 10 * 60 * 1000;

const searchOpts = {
  staleTime: SEARCH_STALE,
  gcTime: SEARCH_GC,
  // A failed search is shown (or falls back to the local cache); retrying
  // would double a request the server may be rate limiting.
  retry: false,
} as const;

export const searchSubjectsQuery = (q: string) =>
  queryOptions({
    queryKey: qk.searchSubjects(q),
    queryFn: ({ signal }) => searchSubjects(q, 20, signal),
    ...searchOpts,
  });

export const searchQuestionsQuery = (q: string) =>
  queryOptions({
    queryKey: qk.searchQuestions(q),
    queryFn: ({ signal }) => searchAllQuestions(q, 20, signal),
    ...searchOpts,
  });

export const searchNotesQuery = (q: string) =>
  queryOptions({
    queryKey: qk.searchNotes(q),
    queryFn: ({ signal }) => searchTopicNotes(q, 20, signal),
    ...searchOpts,
  });

// Asked once per app session: a deployment with the feature off costs one
// cheap call. getAiOverviewStatus never throws (false on failure).
export const aiOverviewStatusQuery = () =>
  queryOptions({
    queryKey: qk.aiOverviewStatus(),
    queryFn: ({ signal }) => getAiOverviewStatus(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

// Every miss is billed server-side, so a repeat of the same query within the
// window reuses the answer instead of paying again.
export const aiOverviewQuery = (q: string) =>
  queryOptions({
    queryKey: qk.aiOverview(q),
    queryFn: ({ signal }) => getAiOverview(q, undefined, signal),
    ...searchOpts,
  });

/** True while a fresh cached answer for this search exists (no request needed). */
export const isSearchCached = (queryClient: QueryClient, q: string): boolean => {
  const state = queryClient.getQueryState(qk.searchSubjects(q));
  return (
    state?.status === 'success' && Date.now() - state.dataUpdatedAt < SEARCH_STALE
  );
};

// Paged. Shared by the All Subjects screen and the Search screen's suggestion
// chips (first page), so opening one warms the other.
export const allSubjectsQuery = (q: string) =>
  infiniteQueryOptions({
    queryKey: qk.allSubjects(q),
    queryFn: ({ pageParam, signal }) =>
      listAllSubjects({ q: q.trim() || undefined, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

// The admin can revise notes at any time, so always revalidate on mount
// (staleTime 0); React Query shows the previous copy while it does, and it is
// never persisted, so a student cannot be stuck on a stale on-disk copy.
export const topicNotesQuery = (subjectId: string, topicId: string) =>
  queryOptions({
    queryKey: qk.topicNotes(subjectId, topicId),
    queryFn: ({ signal }) => getTopicNotes(subjectId, topicId, signal),
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  });

type Opts = { enabled?: boolean };

export const useSemesters = () => useQuery(semestersQuery());
export const useSubjects = (semesterId: string, o: Opts = {}) =>
  useQuery({ ...subjectsQuery(semesterId), enabled: !!semesterId && o.enabled !== false });
export const useSubjectMeta = (subjectId: string, o: Opts = {}) =>
  useQuery({ ...subjectMetaQuery(subjectId), enabled: !!subjectId && o.enabled !== false });
export const useQuestions = (subjectId: string, params: QuestionParams = {}, o: Opts = {}) =>
  useQuery({ ...questionsQuery(subjectId, params), enabled: !!subjectId && o.enabled !== false });
export const useQuestion = (subjectId: string, questionId: string, o: Opts = {}) =>
  useQuery({
    ...questionQuery(subjectId, questionId),
    enabled: !!subjectId && !!questionId && o.enabled !== false,
  });
export const useSolution = (subjectId: string, questionId: string, o: Opts = {}) =>
  useQuery({
    ...solutionQuery(subjectId, questionId),
    enabled: !!subjectId && !!questionId && o.enabled !== false,
  });
export const useSyllabusBranches = () => useQuery(syllabusBranchesQuery());
export const useSyllabusSemesters = (branch: string, o: Opts = {}) =>
  useQuery({ ...syllabusSemestersQuery(branch), enabled: !!branch && o.enabled !== false });
export const useSyllabusSemester = (branch: string, semester: number, o: Opts = {}) =>
  useQuery({
    ...syllabusSemesterQuery(branch, semester),
    enabled: !!branch && !!semester && o.enabled !== false,
  });
export const useSyllabusSubject = (subject: string, o: Opts = {}) =>
  useQuery({ ...syllabusSubjectQuery(subject), enabled: !!subject && o.enabled !== false });
