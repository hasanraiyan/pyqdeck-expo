import { type CalloutType, parseCalloutBlock } from './calloutParser';

export type ContentBlock =
  | { type: 'code'; code: string; language: string }
  | { type: 'mermaid'; code: string }
  | { type: 'display_math'; math: string }
  | { type: 'callout'; calloutType: CalloutType; title?: string; content: string }
  | { type: 'markdown'; content: string };

/**
 * Normalizes line breaks and raw breaks from JSON / OCR imports.
 */
export function normalizeBreaks(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<br\s*\/?>/gi, '\n');
}

/**
 * Splits markdown content into structural blocks:
 * 1. Fenced code blocks (```lang ... ```) -> NativeCodeBlock
 * 2. Display math ($$...$$ or \[...\]) -> NativeMathView (SVG)
 * 3. Markdown alert callouts (> [!NOTE] ...) -> CalloutCard
 * 4. Markdown prose (with inline math) -> native Markdown display
 */
export function parseContentBlocks(rawText: string): ContentBlock[] {
  if (!rawText) return [];

  const text = normalizeBreaks(rawText);
  const blocks: ContentBlock[] = [];

  // Match fenced code blocks (```...```), display math ($$...$$ or \[...\]),
  // standalone LaTeX environments (\begin{pmatrix}...\end{pmatrix}, etc.),
  // or markdown alert callout blocks (> [!NOTE] ...)
  const BLOCK_REGEX =
    /(```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```|`\$\$([\s\S]+?)\$\$`|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\begin\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix|aligned|align\*?|gather\*?|equation\*?|cases)\}([\s\S]*?)\\end\{\7\}|(?:^|\r?\n)>\s*\[!(?:NOTE|INFO|TIP|HINT|PROTIP|WARNING|WARN|EXAM|EXAM_TRAP|VIVA|CAUTION|CRUCIAL|IMPORTANT|DANGER)\][^\r\n]*(?:\r?\n>\s?[^\r\n]*)*)/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BLOCK_REGEX.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;

    // Any markdown preceding this block
    if (matchStart > lastIndex) {
      const preceding = text.substring(lastIndex, matchStart).trim();
      if (preceding.length > 0) {
        blocks.push({ type: 'markdown', content: preceding });
      }
    }

    if (match[1] && match[1].startsWith('```')) {
      // Fenced code block or mermaid diagram
      const language = (match[2] || 'text').trim();
      const code = match[3] || '';
      if (language.toLowerCase() === 'mermaid') {
        blocks.push({ type: 'mermaid', code: code.trim() });
      } else {
        blocks.push({ type: 'code', code, language });
      }
    } else if (match[7]) {
      // LaTeX environment block like \begin{pmatrix}...\end{pmatrix}
      const fullEnv = match[0].trim();
      if (fullEnv.length > 0) {
        blocks.push({ type: 'display_math', math: fullEnv });
      }
    } else if (match[4] || match[5] || match[6]) {
      // Display math ($$...$$ or \[...\])
      const math = (match[4] || match[5] || match[6] || '').trim();
      if (math.length > 0) {
        blocks.push({ type: 'display_math', math });
      }
    } else {
      // Markdown alert callout block
      const rawCallout = match[0].trim();
      const calloutData = parseCalloutBlock(rawCallout);
      if (calloutData) {
        blocks.push({
          type: 'callout',
          calloutType: calloutData.type,
          title: calloutData.title,
          content: calloutData.content,
        });
      } else {
        blocks.push({ type: 'markdown', content: rawCallout });
      }
    }

    lastIndex = matchEnd;
  }

  // Any remaining markdown after last match
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex).trim();
    if (remaining.length > 0) {
      blocks.push({ type: 'markdown', content: remaining });
    }
  }

  return blocks;
}
