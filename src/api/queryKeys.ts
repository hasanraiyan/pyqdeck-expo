// Single source of truth for every React Query key. Screens and hooks build
// keys ONLY through this module: a hand-built key that forgets a parameter
// (e.g. the subject id) silently shares one cache entry between unrelated
// requests - that is exactly how "Web Technology Q6" showed up as the
// Software Engineering Q6 solution.
export type QuestionParams = {
  year?: number;
  chapter?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

// Drop undefined/empty params and fix the order so equal requests always
// produce equal keys.
const normalizeParams = (p: QuestionParams = {}) => ({
  year: p.year ?? null,
  chapter: p.chapter ? p.chapter.trim().toLowerCase() : null,
  search: p.search ? p.search.trim() : null,
  limit: p.limit ?? 50,
  offset: p.offset ?? 0,
});

export const qk = {
  semesters: () => ['semesters'] as const,
  subjects: (semesterId: string) => ['subjects', semesterId] as const,
  subjectMeta: (subjectId: string) => ['subject', subjectId] as const,
  questions: (subjectId: string, params?: QuestionParams) =>
    ['questions', subjectId, normalizeParams(params)] as const,
  question: (subjectId: string, questionId: string) =>
    ['question', subjectId, questionId] as const,
  solution: (subjectId: string, questionId: string) =>
    ['solution', subjectId, questionId] as const,
  similar: (subjectId: string, questionId: string, limit: number) =>
    ['similar', subjectId, questionId, limit] as const,
  repeats: (subjectId: string, questionId: string, limit: number) =>
    ['repeats', subjectId, questionId, limit] as const,
  syllabusBranches: () => ['syllabus', 'branches'] as const,
  syllabusSemesters: (branch: string) => ['syllabus', 'semesters', branch] as const,
  syllabusSemester: (branch: string, semester: number) =>
    ['syllabus', 'semester', branch, semester] as const,
  syllabusSubject: (subject: string) => ['syllabus', 'subject', subject] as const,
  // Search keys carry the lower-cased query so "OS", "os" and "Os" share one
  // entry. None of these are persisted (see queries.ts).
  searchSubjects: (q: string) => ['search', 'subjects', q.toLowerCase()] as const,
  searchQuestions: (q: string) => ['search', 'questions', q.toLowerCase()] as const,
  searchNotes: (q: string) => ['search', 'notes', q.toLowerCase()] as const,
  aiOverviewStatus: () => ['search', 'ai-status'] as const,
  aiOverview: (q: string) => ['search', 'ai-overview', q.toLowerCase()] as const,
  allSubjects: (q: string) => ['allSubjects', q.trim().toLowerCase()] as const,
  topicNotes: (subjectId: string, topicId: string) =>
    ['topicNotes', subjectId, topicId] as const,
};
