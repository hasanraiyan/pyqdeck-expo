import { Platform, Share } from 'react-native';

// Must stay in sync with pyqdeck-frontend's app/[semester]/[subject]/[year]/[questionId]
// route - this is the exact path both the website and Android App Links (see
// app.json's intentFilters + the site's public/.well-known/assetlinks.json) resolve.
export function buildQuestionUrl(
  semesterId: string,
  subjectId: string,
  year: number | string,
  questionId: string
): string {
  return `https://pyqdeck.in/${semesterId}/${subjectId}/${year}/${questionId}`;
}

export function formatQuestionShareMessage({
  subjectName,
  year,
  qNumber,
  marks,
  text,
  semesterId,
  subjectId,
  questionId,
}: {
  subjectName?: string;
  year?: number | string;
  qNumber?: string;
  marks?: number | null;
  text?: string;
  semesterId: string;
  subjectId: string;
  questionId: string;
}): string {
  const url = buildQuestionUrl(semesterId, subjectId, year || '', questionId);

  // Clean markdown formatting from text for plain messaging apps
  const cleanText = (text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Shorten preview if question text is excessively long
  const maxLen = 300;
  const questionSnippet =
    cleanText.length > maxLen ? `${cleanText.slice(0, maxLen).trim()}...` : cleanText;

  const headerParts = [];
  if (subjectName) headerParts.push(subjectName);
  if (year) headerParts.push(`(${year} Paper)`);
  const headerLine = `📝 BEU ${headerParts.join(' ')}`.trim();

  const qMeta = [];
  if (qNumber) qMeta.push(qNumber);
  if (marks) qMeta.push(`(${marks} Marks)`);
  const qMetaPrefix = qMeta.length > 0 ? `${qMeta.join(' ')}: ` : '';

  return `${headerLine}\n\n${qMetaPrefix}${questionSnippet}\n\n📖 View complete solution on PyQdeck:\n${url}`;
}

export async function shareQuestion(params: {
  subjectName?: string;
  year?: number | string;
  qNumber?: string;
  marks?: number | null;
  text?: string;
  semesterId: string;
  subjectId: string;
  questionId: string;
}): Promise<void> {
  try {
    const message = formatQuestionShareMessage(params);
    const url = buildQuestionUrl(params.semesterId, params.subjectId, params.year || '', params.questionId);
    await Share.share(
      Platform.select({
        ios: { message, url },
        default: { message },
      })
    );
  } catch (err) {
    console.error('Failed to share question:', err);
  }
}


// Same rule as pyqdeck-frontend's lib/topic-slug.ts. The slug is cosmetic (the
// site 308s a wrong one to the canonical form and the app ignores it), but
// keeping it identical means a shared link is already canonical.
export function topicSlug(title: string): string {
  const slug = (title || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'topic';
}

// Matches the website route and the app's TopicNotes deep link
// (syllabus/subject/:subjectId/topic/:topicId/:topicSlug?), both already
// covered by app.json's /syllabus/.* intent filters.
export function buildTopicUrl(subjectId: string, topicId: string, title: string): string {
  return `https://pyqdeck.in/syllabus/subject/${encodeURIComponent(subjectId)}/topic/${encodeURIComponent(topicId)}/${topicSlug(title)}`;
}

export async function shareTopic(params: {
  subjectId: string;
  topicId: string;
  title: string;
  subjectName?: string;
}): Promise<void> {
  try {
    const url = buildTopicUrl(params.subjectId, params.topicId, params.title);
    const header = [params.title, params.subjectName].filter(Boolean).join(' · ');
    const message = `📚 ${header}
Study notes on PYQdeck:
${url}`;
    await Share.share(
      Platform.select({
        ios: { message, url },
        default: { message },
      })
    );
  } catch (err) {
    console.error('Failed to share notes:', err);
  }
}
