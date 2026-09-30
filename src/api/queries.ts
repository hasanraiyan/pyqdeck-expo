import { queryOptions, useQuery } from '@tanstack/react-query';
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
} from './index';
import { qk, QuestionParams } from './queryKeys';
import { persistMeta, STALE } from './queryClient';

// Query definitions (key + fetcher + freshness + persistence) live here so the
// hooks below and any imperative queryClient.fetchQuery/prefetchQuery call
// share exactly one definition per request.

export const semestersQuery = () =>
  queryOptions({ queryKey: qk.semesters(), queryFn: () => getSemesters(), meta: persistMeta });

export const subjectsQuery = (semesterId: string) =>
  queryOptions({
    queryKey: qk.subjects(semesterId),
    queryFn: () => getSubjects(semesterId),
    meta: persistMeta,
  });

export const subjectMetaQuery = (subjectId: string) =>
  queryOptions({
    queryKey: qk.subjectMeta(subjectId),
    queryFn: () => getSubjectMeta(subjectId),
    meta: persistMeta,
  });

export const questionsQuery = (subjectId: string, params: QuestionParams = {}) =>
  queryOptions({
    queryKey: qk.questions(subjectId, params),
    queryFn: () => getQuestions(subjectId, params),
    meta: persistMeta,
  });

export const questionQuery = (subjectId: string, questionId: string) =>
  queryOptions({
    queryKey: qk.question(subjectId, questionId),
    queryFn: () => getQuestion(subjectId, questionId),
    meta: persistMeta,
  });

export const solutionQuery = (subjectId: string, questionId: string) =>
  queryOptions({
    queryKey: qk.solution(subjectId, questionId),
    queryFn: () => getSolution(subjectId, questionId),
    meta: persistMeta,
  });

export const similarQuery = (subjectId: string, questionId: string, limit = 5) =>
  queryOptions({
    queryKey: qk.similar(subjectId, questionId, limit),
    queryFn: () => getSimilarQuestions(subjectId, questionId, limit),
    staleTime: STALE.volatile,
    gcTime: STALE.volatile,
  });

export const repeatsQuery = (subjectId: string, questionId: string, limit = 5) =>
  queryOptions({
    queryKey: qk.repeats(subjectId, questionId, limit),
    queryFn: () => getRepeatedQuestions(subjectId, questionId, limit),
    staleTime: STALE.volatile,
    gcTime: STALE.volatile,
  });

// Syllabus: staleTime 0 = network-first on every mount; the persisted copy is
// the offline fallback (React Query keeps the last data when a refetch fails).
export const syllabusBranchesQuery = () =>
  queryOptions({
    queryKey: qk.syllabusBranches(),
    queryFn: () => getBranches(),
    staleTime: STALE.syllabus,
    meta: persistMeta,
  });

export const syllabusSemestersQuery = (branch: string) =>
  queryOptions({
    queryKey: qk.syllabusSemesters(branch),
    queryFn: () => getBranchSemesters(branch),
    staleTime: STALE.syllabus,
    meta: persistMeta,
  });

export const syllabusSemesterQuery = (branch: string, semester: number) =>
  queryOptions({
    queryKey: qk.syllabusSemester(branch, semester),
    queryFn: () => getBranchSemester(branch, semester),
    staleTime: STALE.syllabus,
    meta: persistMeta,
  });

export const syllabusSubjectQuery = (subject: string) =>
  queryOptions({
    queryKey: qk.syllabusSubject(subject),
    queryFn: () => getSyllabusSubject(subject),
    staleTime: STALE.syllabus,
    meta: persistMeta,
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
