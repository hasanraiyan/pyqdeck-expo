import { queryClient } from './queryClient';
import { QuestionListResult, QuestionSummary, SubjectSummary } from '../types';

/**
 * Offline search fallback over whatever React Query already holds (restored
 * from the persisted cache): every question list and single question that was
 * browsed. Questions keep the subject they were fetched under, so a hit can be
 * opened in the right subject.
 */
export async function searchLocalCache(query: string) {
  const term = query.toLowerCase().trim();
  const seen = new Set<string>();
  const questions: (QuestionSummary & { subject: { id: string; name: string; semesterId: string } })[] =
    [];

  const results = [
    ...queryClient.getQueriesData<QuestionListResult>({ queryKey: ['questions'] }),
    ...queryClient.getQueriesData<QuestionListResult>({ queryKey: ['question'] }),
  ];

  for (const [, result] of results) {
    if (!result?.questions) continue;
    const subject = { id: result.subject?.id ?? '', name: result.subject?.name ?? '', semesterId: '' };
    for (const q of result.questions) {
      const id = `${subject.id}:${q.questionId}`;
      if (seen.has(id)) continue;
      if (
        (q.text && q.text.toLowerCase().includes(term)) ||
        (q.chapter && q.chapter.toLowerCase().includes(term)) ||
        (subject.name && subject.name.toLowerCase().includes(term))
      ) {
        seen.add(id);
        questions.push({ ...q, subject });
      }
    }
  }

  return { subjects: [] as SubjectSummary[], questions: questions.slice(0, 20) };
}
