import { AiOverviewReference } from '../types';

/**
 * Opens a page cited by an AI answer. Shared by the search screen (overview
 * card) and the chat, so a source opens the same place from both.
 *
 * Preferred: the server's canonical URL, but routed into THIS tab's own stack -
 * never via linkTo(). linkTo() resolves these paths into the Syllabus/Browse
 * stacks, and when that stack isn't mounted yet the target becomes its root:
 * no back button, no way back to results (or to the Study home). SearchStack
 * registers TopicNotes, QuestionDetail and QuestionList (see App.tsx), so a
 * plain navigate pushes over the current screen with the header back intact.
 * Regex, not new URL(): Hermes has no URL global to rely on.
 */
export const openAiReference = (
  navigation: { navigate: (name: string, params?: any) => void },
  linkTo: (path: string) => void,
  ref: AiOverviewReference
): void => {
  const raw = ref.url;
  if (raw) {
    const m = raw.match(/^https:\/\/(www\.)?pyqdeck\.in(\/[^?#]*)?(\?[^#]*)?/);
    if (m) {
      const path = m[2] || '/';
      const topic = path.match(/^\/syllabus\/subject\/([^/]+)\/topic\/([^/]+)/);
      if (topic) {
        // Bare ids - the resolver on TopicNotesScreen fills in the
        // title/module, same as a deep link.
        navigation.navigate('TopicNotes', { subjectId: topic[1], topicId: topic[2] });
        return;
      }
      const parts = path.split('/').filter(Boolean);
      const year = parts.length >= 3 ? Number(parts[2]) : NaN;
      if (!Number.isNaN(year)) {
        if (parts.length === 4) {
          navigation.navigate('QuestionDetail', {
            semesterId: parts[0],
            subjectId: parts[1],
            year,
            questionId: parts[3],
          });
          return;
        }
        if (parts.length === 3 && parts[0] !== 'syllabus') {
          navigation.navigate('QuestionList', {
            semesterId: parts[0],
            subjectId: parts[1],
            year,
          });
          return;
        }
      }
      // Anything else (semester sheets, /search) is owned by other stacks -
      // those still go through the deep-link config.
      try {
        linkTo(path + (m[3] || ''));
        return;
      } catch {
        // Unmatched path (a route the app does not know yet) - fall
        // through to the param-based handling below, then give up.
      }
    }
  }
  // Fallback for cached payloads from before `url` existed.
  const nav = ref.navigate;
  if (!nav) return;
  if (nav.target === 'topic' && nav.subjectSlug && nav.topicId) {
    // A cited study note - the resolver on TopicNotesScreen fills in the
    // title/module from the bare ids, same as a deep link.
    navigation.navigate('TopicNotes', {
      subjectId: nav.subjectSlug,
      topicId: nav.topicId,
    });
    return;
  }
  if (nav.target === 'question') {
    navigation.navigate('QuestionDetail', {
      subjectId: nav.subjectId,
      semesterId: nav.semesterId,
      questionId: nav.questionId,
      year: nav.year,
    });
    return;
  }
  // A whole paper rather than one question.
  navigation.navigate('QuestionList', {
    subjectId: nav.subjectId,
    semesterId: nav.semesterId,
    year: nav.year,
  });
};
