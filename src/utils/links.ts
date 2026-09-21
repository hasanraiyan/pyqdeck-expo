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

