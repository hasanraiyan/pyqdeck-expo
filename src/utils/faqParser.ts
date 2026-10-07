export interface FaqItem {
  question: string;
  answer: string;
}

export interface SplitNotesResult {
  notesBody: string;
  faqs: FaqItem[];
}

/**
 * Regex matching the start of an FAQ section in topic notes markdown.
 * Matches:
 * ## FAQ
 * ## FAQs
 * ## Frequently Asked Questions
 * ## Viva Questions
 * ## Common Questions & Answers
 * ## Important Exam Questions
 */
const FAQ_HEADER_REGEX = /(?:^|\n)##\s*(?:Frequently Asked Questions|FAQs?|Viva\s*(?:&|and)?\s*Exam Questions|Common Questions|Important\s*(?:Viva|Exam|FAQ)?\s*Questions)\b[^\n]*/i;

/**
 * Regex matching the start of an individual question item within the FAQ section.
 * Supports:
 * - ### Q: ... / ### Q1: ... / ### Question 1: ...
 * - ### What is ...?
 * - **Q: ...** / **Question 1: ...**
 * - Q: ... / Q1. ...
 */
const QUESTION_DELIMITER_REGEX = /(?:^|\n)(?=(?:###\s*|\*\*\s*Q(?:uestion)?\s*\d*\s*[:.]?\s*|Q\d*\s*[:.]\s*))/i;

/**
 * Cleans leading question prefixes like "###", "Q1:", "Question:", "**", etc.
 */
function cleanQuestionTitle(raw: string): string {
  let cleaned = raw.trim();
  // Remove markdown header marks
  cleaned = cleaned.replace(/^#{1,4}\s*/, '');
  // Remove bold tags
  cleaned = cleaned.replace(/^\*\*(.*?)\*\*$/, '$1');
  // Remove Q: / Q1: / Question 1: prefix
  cleaned = cleaned.replace(/^Q(?:uestion)?\s*\d*\s*[:.]\s*/i, '');
  // Remove trailing bold stars or colons if present
  cleaned = cleaned.replace(/\*\*$/, '').trim();
  return cleaned;
}

/**
 * Splits a topic note's markdown into the main prose body and an array of FAQ items.
 * If no FAQ section exists, returns the original content with an empty faqs array.
 */
export function extractFaqsFromNotes(content: string | null | undefined): SplitNotesResult {
  if (!content || typeof content !== 'string') {
    return { notesBody: '', faqs: [] };
  }

  const trimmed = content.trim();
  const match = trimmed.match(FAQ_HEADER_REGEX);

  if (!match || match.index === undefined) {
    return { notesBody: trimmed, faqs: [] };
  }

  const headerIndex = match.index;
  const headerLength = match[0].length;

  const notesBody = trimmed.substring(0, headerIndex).trim();
  const faqRawBlock = trimmed.substring(headerIndex + headerLength).trim();

  if (!faqRawBlock) {
    return { notesBody, faqs: [] };
  }

  // Split into candidate Q&A blocks
  const rawItems = faqRawBlock.split(QUESTION_DELIMITER_REGEX).map((s) => s.trim()).filter(Boolean);
  const faqs: FaqItem[] = [];

  for (const block of rawItems) {
    // A block contains a question on the first line (or heading) and the answer as the rest
    const lines = block.split(/\r?\n/);
    if (lines.length === 0) continue;

    const firstLine = lines[0].trim();
    if (!firstLine) continue;

    const question = cleanQuestionTitle(firstLine);
    const answer = lines.slice(1).join('\n').trim();

    if (question && answer) {
      faqs.push({ question, answer });
    } else if (question && !answer && lines.length === 1) {
      // Single line item without explicit answer - skip or treat as question
      continue;
    }
  }

  // If we couldn't parse any actual Q&A items, keep original content intact
  if (faqs.length === 0) {
    return { notesBody: trimmed, faqs: [] };
  }

  return {
    notesBody,
    faqs,
  };
}
