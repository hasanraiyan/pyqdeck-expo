/**
 * Syllabus is a separate axis from the PYQ archive: PYQs are organized by
 * semester -> subject -> year, while the syllabus is branch -> semester ->
 * subject -> module -> topic. A student picks a branch once; everything
 * below it follows from that choice.
 */

export interface Branch {
  id: string;
  code: string;
  name: string;
  subjectCount: number;
}

export interface Topic {
  id: string;
  title: string;
}

export interface SyllabusModule {
  id: string;
  number: number;
  title: string;
  topics: Topic[];
}

/**
 * Lecture / Tutorial / Practical hours per week and the credit weight, as
 * printed in the university's own syllabus document. Optional: older or
 * partially typed-up semesters may not carry it, and the screen leaves the
 * table out entirely rather than showing blanks.
 */
export interface Credits {
  l: number;
  t: number;
  p: number;
  credits: number;
}

export interface SyllabusSubject {
  id: string;
  code: string;
  name: string;
  credits?: Credits;
  /** Lab subjects list experiments rather than modules; same shape, different word. */
  kind: 'theory' | 'lab';
  modules: SyllabusModule[];
  /** Set when this subject also exists in the PYQ archive, so we can link across. */
  pyqSubjectId?: string;
}

export interface SyllabusSemester {
  number: number;
  subjects: SyllabusSubject[];
}

export const topicCountOf = (subject: SyllabusSubject) =>
  subject.modules.reduce((n, m) => n + m.topics.length, 0);
