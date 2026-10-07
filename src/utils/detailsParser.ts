export interface DetailsBlockData {
  summary: string;
  content: string;
  defaultOpen?: boolean;
}

/**
 * Regex to match an entire standalone <details><summary>...</summary>...</details> HTML block in Markdown.
 * Requires <details> to start on a new line and <summary> to contain a single-line title without nested tags.
 */
export const DETAILS_REGEX =
  /(?:^|\r?\n)<details(\s+open)?\s*>\s*<summary>([^\r\n<]+)<\/summary>([\s\S]*?)<\/details>/gi;

/**
 * Parses a raw <details> string into structured summary, content, and defaultOpen flag.
 */
export function parseDetailsBlock(rawText: string): DetailsBlockData | null {
  if (!rawText) return null;
  const match = /<details(\s+open)?\s*>\s*<summary>([^\r\n<]+)<\/summary>([\s\S]*?)<\/details>/i.exec(rawText);
  if (!match) return null;

  const defaultOpen = Boolean(match[1]);
  const summary = (match[2] || '').trim();
  const content = (match[3] || '').trim();

  return {
    summary: summary || 'Details & Solution Hint',
    content,
    defaultOpen,
  };
}
