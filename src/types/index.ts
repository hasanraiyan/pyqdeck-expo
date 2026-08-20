export interface Semester {
  id: string;
  number: number;
}

export interface SubjectSummary {
  id: string;
  name: string;
  code: string;
  questionCount: number;
}

export interface SubjectMeta {
  id: string;
  name: string;
  code: string;
  years: { year: number; questionCount: number }[];
  chapters: { chapter: string; questionCount: number }[];
}

export interface QuestionSummary {
  questionId: string;
  year: number;
  qNumber: string;
  chapter: string;
  text: string;
  textPreview: string;
  textHtml: string;
  type: string;
  marks: number;
  hasSolution: boolean;
}

export interface QuestionListResult {
  subject: { id: string; name: string };
  total: number;
  returned: number;
  offset: number;
  questions: QuestionSummary[];
}

export interface Solution {
  subject: { id: string; name: string };
  questionId: string;
  content: string;
  contentHtml: string;
  type: string;
  votes: number;
  isVerified: boolean | null;
}

export interface SubjectSearchResult {
  query: string;
  total: number;
  subjects: (SubjectSummary & { semester: Semester })[];
}

export interface SubjectsPage {
  query: string;
  page: number;
  limit: number;
  total: number;
  pageCount: number;
  subjects: (SubjectSummary & { semester: Semester })[];
}

export interface AllQuestionsSearchResult {
  query: string;
  total: number;
  returned: number;
  offset: number;
  questions: (QuestionSummary & { subject: { id: string; name: string; semesterId: string } })[];
}

export interface SimilarQuestionsResult {
  questions: (QuestionSummary & { subject: { id: string; name: string; semesterId: string }; score: number })[];
}

export type RepeatedQuestionsResult = SimilarQuestionsResult;
