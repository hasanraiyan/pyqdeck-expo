import { queryClient } from './queryClient';
import { subjectMetaQuery, questionsQuery, questionQuery } from './queries';

// Warms the cache for a subject the moment a student taps it, so
// QuestionListScreen finds its data already loaded (or in flight) instead of
// starting meta -> questions serially after the navigation animation.
//
// Fire-and-forget by design: it never throws and never blocks navigation. If
// the screen mounts while a prefetch is in flight, React Query de-duplicates
// onto it. The params must match what QuestionListScreen requests, or the keys
// differ and the prefetch is wasted.
export function prefetchSubject(
  subjectId: string,
  opts: { year?: number; chapter?: string } = {}
): void {
  if (!subjectId) return;
  void warmSubject(subjectId, opts).catch(() => {});
}

async function warmSubject(
  subjectId: string,
  { year, chapter }: { year?: number; chapter?: string }
): Promise<void> {
  // An explicit year or chapter is exactly what the list screen will ask for;
  // nothing to wait for. Only the default case needs meta to find the latest year.
  if (year || chapter) {
    void queryClient.prefetchQuery(subjectMetaQuery(subjectId));
    await queryClient.prefetchQuery(questionsQuery(subjectId, { year, chapter }));
    return;
  }
  const meta = await queryClient.fetchQuery(subjectMetaQuery(subjectId));
  const latest = meta.years?.[0]?.year;
  if (latest) await queryClient.prefetchQuery(questionsQuery(subjectId, { year: latest }));
}

// Same idea for a single question (the "Continue" card opens straight into one).
export function prefetchQuestion(subjectId: string, questionId: string): void {
  if (!subjectId || !questionId) return;
  void queryClient.prefetchQuery(questionQuery(subjectId, questionId)).catch(() => {});
}
