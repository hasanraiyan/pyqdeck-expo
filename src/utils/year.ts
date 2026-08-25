// Academic year (1-4) is derived from semester number (1-8) - there is no
// "year" field anywhere in the backend data model. Not to be confused with
// the unrelated exam-paper year shown via YearBadge / used in deep links.
export function yearNumberOf(semesterNumber: number): number {
  return Math.ceil(semesterNumber / 2);
}

export function semesterNumbersForYear(year: number): [number, number] {
  return [year * 2 - 1, year * 2];
}

export const YEAR_NUMBERS = [1, 2, 3, 4] as const;
