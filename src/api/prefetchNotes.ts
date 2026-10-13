import { queryClient } from './queryClient';
import { topicNotesQuery } from './queries';

// A prefetched note counts as fresh for this long, so tapping it shows it at
// once. The notes screen's own query still revalidates on mount (staleTime 0),
// so an admin's edit is never hidden behind the prefetched copy.
const PREFETCH_FRESH_MS = 2 * 60 * 1000;
// Notes are fetched one after another, not all at once, so prefetching never
// competes with the note the student is actually waiting for.
const STAGGER_MS = 600;

const scheduled = new Set<string>();

/**
 * Quietly loads the notes of the topics a student is most likely to open next, so
 * they open instantly. Safe to call repeatedly: a note that is already fresh or
 * already scheduled is skipped, and a failed fetch is ignored (the screen just
 * fetches normally when the note is opened).
 */
export function prefetchTopicNotes(subjectId: string | undefined, topicIds: Array<string | undefined>) {
  if (!subjectId) return;
  const ids = topicIds.filter((id): id is string => !!id);
  ids.forEach((topicId, i) => {
    const key = `${subjectId}:${topicId}`;
    if (scheduled.has(key)) return;
    scheduled.add(key);
    setTimeout(() => {
      queryClient
        .prefetchQuery({ ...topicNotesQuery(subjectId, topicId), staleTime: PREFETCH_FRESH_MS })
        .catch(() => {})
        .finally(() => scheduled.delete(key));
    }, i * STAGGER_MS);
  });
}
