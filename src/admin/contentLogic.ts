/**
 * Pure checks for the question editor, so the rules are testable without React.
 * They mirror what the server accepts; the server stays the real gate.
 */

export interface QuestionFieldsInput {
  questionId: string;
  year: string;
  marks: string;
  text: string;
  creating: boolean;
}

export interface QuestionProblems {
  questionId: string | null;
  year: string | null;
  marks: string | null;
  text: string | null;
  /** Anything wrong on the Details tab / on the Text tab, to mark the tabs. */
  details: boolean;
  any: boolean;
}

export function validateQuestionFields(i: QuestionFieldsInput): QuestionProblems {
  const id = i.questionId.trim();
  const questionId = !i.creating
    ? null
    : !id
      ? 'Add a question ID.'
      : id.length > 40
        ? 'At most 40 characters.'
        : null;

  let year: string | null = null;
  if (i.year.trim()) {
    const y = Number(i.year);
    if (!Number.isInteger(y) || y < 1990 || y > 2100) year = 'Use a 4-digit year, 1990 to 2100.';
  }

  let marks: string | null = null;
  if (i.marks.trim()) {
    const m = Number(i.marks);
    if (!Number.isFinite(m) || m < 0 || m > 1000) marks = 'Use a number from 0 to 1000.';
  }

  const text = i.text.trim() ? null : 'The question text is empty.';
  const details = !!(questionId || year || marks);
  return { questionId, year, marks, text, details, any: details || !!text };
}

/** Next unused "Q<n>" id given the ids already in the subject. */
export function suggestQuestionId(existing: string[]): string {
  let max = 0;
  for (const id of existing) {
    const m = /^q(\d+)$/i.exec(id.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Q${max + 1}`;
}
