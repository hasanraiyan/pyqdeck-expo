/**
 * Syllabus is a separate axis from the PYQ archive: PYQs are organized by
 * semester -> subject -> year, while the syllabus is branch -> semester ->
 * subject -> module -> topic.
 *
 * Shapes mirror /api/public/syllabus/* exactly. Module and topic ids are
 * server-side subdocument ids and are stable across a title being corrected,
 * which is what makes them safe to key saved progress to.
 */

export interface Branch {
  id: string;
  code: string;
  name: string;
  /** Semester numbers that have a syllabus. Present on the branch list. */
  semesters?: number[];
  subjectCount?: number;
}

export interface Topic {
  id: string;
  title: string;
  /** Optional per-topic override for the Ask AI prompt. */
  prompt?: string;
}

export interface SyllabusModule {
  id: string;
  number: number;
  title: string;
  topics: Topic[];
}

export interface Credits {
  l: number;
  t: number;
  p: number;
  credits: number;
}

/** Row shape in a semester's subject list - counts rather than the tree. */
export interface SyllabusSubjectSummary {
  id: string;
  code?: string;
  name: string;
  kind: 'theory' | 'lab';
  credits?: Credits;
  pyqSubjectId?: string;
  moduleCount: number;
  topicCount: number;
}

/** A subject with its full module and topic tree. */
export interface SyllabusSubject {
  id: string;
  code?: string;
  name: string;
  kind: 'theory' | 'lab';
  credits?: Credits;
  pyqSubjectId?: string;
  modules: SyllabusModule[];
  semester?: number;
  branch?: Branch;
  /** All branches this subject belongs to (shared common subjects have many) - kept internal, not shown to students. */
  branches?: Branch[];
  branchIds?: string[];
}

export interface SemesterEntry {
  semester: number;
  subjectCount: number;
  topicCount: number;
  /** Slugs of the subjects in this semester, for local progress counting. */
  subjectIds: string[];
}

export interface BranchSemesters {
  branch: Branch;
  semesters: SemesterEntry[];
}

export interface BranchSemester {
  branch: Branch;
  semester: number;
  totalCredits: number;
  subjects: SyllabusSubjectSummary[];
}

export const topicCountOf = (subject: SyllabusSubject) =>
  subject.modules.reduce((n, m) => n + m.topics.length, 0);
