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
  upvotes: number;
  downvotes: number;
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

export * from './syllabus';

/** One source behind an AI overview, already resolved to something tappable. */
export interface AiOverviewReference {
  /** 1-based, matching the [n] markers in the summary text. */
  index: number;
  title: string;
  link: string | null;
  /**
   * Canonical https page URL (www host) when the citation points at a real
   * site page. (Same field as the canonical-URL PR adds - kept identical so
   * the two merge cleanly.)
   */
  url?: string | null;
  /**
   * Params to navigate by, or null when the source URL had a shape the server
   * did not recognise - the citation then renders as plain text.
   */
  navigate: {
    semesterId?: string;
    subjectId?: string;
    year?: number;
    questionId?: string;
    /** Study-notes citations carry the subject slug + topic id instead. */
    subjectSlug?: string;
    topicId?: string;
    target: 'question' | 'paper' | 'topic';
  } | null;
}

/** A span of the summary and the references that back it. */
export interface AiOverviewCitation {
  /** UTF-8 byte offsets into `text`. */
  start: number;
  end: number;
  /** 1-based reference indexes. */
  refs: number[];
}

export interface AiOverview {
  enabled: boolean;
  query: string;
  /** Empty when the query produced no summary - show nothing, not an error. */
  text: string;
  references: AiOverviewReference[];
  citations: AiOverviewCitation[];
  totalResults: number;
  cached?: boolean;
}
