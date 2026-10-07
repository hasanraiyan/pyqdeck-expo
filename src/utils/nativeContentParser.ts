import { type CalloutType, parseCalloutBlock } from './calloutParser';
import { type CodeTabItem, groupCodeTabs } from './codeTabParser';
import { type ImageItem, groupImageGalleries } from './imageGalleryParser';
import { extractYouTubeData } from './youtubeParser';
import { parseDetailsBlock } from './detailsParser';
import { type StepperItem, parseSingleStep, groupSteppers } from './stepperParser';

export type ContentBlock =
  | { type: 'code'; code: string; language: string }
  | { type: 'code_tabs'; tabs: CodeTabItem[] }
  | { type: 'mermaid'; code: string }
  | { type: 'display_math'; math: string }
  | { type: 'callout'; calloutType: CalloutType; title?: string; content: string }
  | { type: 'image'; src: string; alt?: string }
  | { type: 'image_gallery'; images: ImageItem[] }
  | { type: 'youtube'; videoId: string; url: string; startTime?: number; title?: string }
  | { type: 'details'; summary: string; content: string; defaultOpen?: boolean }
  | { type: 'step_item'; item: StepperItem }
  | { type: 'stepper'; steps: StepperItem[] }
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
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/(?:^|\r?\n):::stepper[^\r\n]*/gi, '');
}

/**
 * Splits markdown content into structural blocks:
 * 1. Fenced code blocks (```lang ... ```) -> NativeCodeBlock
 * 2. Display math ($$...$$ or \[...\]) -> NativeMathView (SVG)
 * 3. Markdown alert callouts (> [!NOTE] ...) -> CalloutCard
 * 4. Image blocks & galleries -> ImageGalleryBlock
 * 5. YouTube video cards -> YouTubeCard
 * 6. Collapsible details / spoilers (<details><summary>...</summary>...</details>) -> DetailsSpoilerBlock
 * 7. Algorithmic steps (:::step 1: Title ...) -> StepperTimelineBlock
 * 8. Markdown prose (with inline math) -> native Markdown display
 */
export function parseContentBlocks(rawText: string): ContentBlock[] {
  if (!rawText) return [];

  const text = normalizeBreaks(rawText);
  const blocks: ContentBlock[] = [];

  const BLOCK_REGEX =
    /(```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```|`\$\$([\s\S]+?)\$\$`|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\begin\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix|aligned|align\*?|gather\*?|equation\*?|cases)\}([\s\S]*?)\\end\{\7\}|(?:^|\r?\n)<details(?:\s+open)?\s*>\s*<summary>[^\r\n<]+<\/summary>[\s\S]*?<\/details>|(?:^|\r?\n):::step(?![a-zA-Z0-9_-])[ \t]*[^\r\n]*\r?\n[\s\S]*?(?:\r?\n:::(?!\w)|\r?\n(?=#{1,6}\s|---|:::step\b|$))|(?:^|\r?\n)>\s*\[!(?:NOTE|INFO|TIP|HINT|PROTIP|WARNING|WARN|EXAM|EXAM_TRAP|VIVA|CAUTION|CRUCIAL|IMPORTANT|DANGER)\][^\r\n]*(?:\r?\n>\s?[^\r\n]*)*|(?:^|\r?\n)!\[(.*?)\]\((https?:\/\/[^\s\)\r\n]+|data:image\/[^\s\)\r\n]+|\/[^\s\)\r\n]+|\.{1,2}\/[^\s\)\r\n]+)\)|(?:^|\r?\n)(?:@\[youtube\]\((https?:\/\/[^\s\)\r\n]+)\)|(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^\s\r\n]*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[^\s\r\n]+)|\[([^\]]*)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^\s\r\n]*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[^\s\r\n]+)\)))/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BLOCK_REGEX.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;

    // Any markdown preceding this block
    if (matchStart > lastIndex) {
      const preceding = text.substring(lastIndex, matchStart).trim();
      if (preceding.length > 0) {
        // If the preceding markdown ends with a single heading line (e.g. "### Approach 1: Iterative")
        // right before this code block, split the heading out into its own markdown block so it can be
        // paired with the code block in groupCodeTabs.
        const trailingHeadingMatch = preceding.match(/(^|\n)(#{2,4}[ \t]+[^\r\n]+)\s*$/);
        if (trailingHeadingMatch && match[1] && match[1].startsWith('```') && (match[2] || '').trim().toLowerCase() !== 'mermaid') {
          const headingLine = trailingHeadingMatch[2].trim();
          const proseBefore = preceding.substring(0, trailingHeadingMatch.index! + (trailingHeadingMatch[1] ? trailingHeadingMatch[1].length : 0)).trim();
          if (proseBefore.length > 0) {
            blocks.push({ type: 'markdown', content: proseBefore });
          }
          blocks.push({ type: 'markdown', content: headingLine });
        } else {
          blocks.push({ type: 'markdown', content: preceding });
        }
      }
    }

    const rawMatch = match[0].trim();

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
      if (rawMatch.length > 0) {
        blocks.push({ type: 'display_math', math: rawMatch });
      }
    } else if (match[4] || match[5] || match[6]) {
      // Display math ($$...$$ or \[...\])
      const math = (match[4] || match[5] || match[6] || '').trim();
      if (math.length > 0) {
        blocks.push({ type: 'display_math', math });
      }
    } else if (rawMatch.toLowerCase().startsWith('<details')) {
      // Collapsible details / spoiler block
      const detailsData = parseDetailsBlock(rawMatch);
      if (detailsData) {
        blocks.push({
          type: 'details',
          summary: detailsData.summary,
          content: detailsData.content,
          defaultOpen: detailsData.defaultOpen,
        });
      } else {
        blocks.push({ type: 'markdown', content: rawMatch });
      }
    } else if (rawMatch.startsWith(':::step')) {
      // Algorithmic step item
      const stepItem = parseSingleStep(rawMatch);
      if (stepItem) {
        blocks.push({
          type: 'step_item',
          item: stepItem,
        });
      } else {
        blocks.push({ type: 'markdown', content: rawMatch });
      }
    } else if (match[10]) {
      // Standalone markdown image: match[9] is alt, match[10] is src
      const altText = (match[9] || '').trim();
      const srcUrl = match[10].trim();
      blocks.push({
        type: 'image',
        src: srcUrl,
        alt: altText.length > 0 ? altText : undefined,
      });
    } else if (match[11] || match[12] || match[14]) {
      // YouTube video reference: match[11] is @[youtube](url), match[12] is raw url, match[14] is markdown link url (match[13] is title)
      const rawUrl = match[11] || match[12] || match[14] || '';
      const title = match[13] || undefined;
      const ytData = extractYouTubeData(rawUrl, title);
      if (ytData) {
        blocks.push({
          type: 'youtube',
          videoId: ytData.videoId,
          url: ytData.url,
          startTime: ytData.startTime,
          title: ytData.title,
        });
      } else {
        blocks.push({ type: 'markdown', content: rawMatch });
      }
    } else {
      // Markdown alert callout block
      const calloutData = parseCalloutBlock(rawMatch);
      if (calloutData) {
        blocks.push({
          type: 'callout',
          calloutType: calloutData.type,
          title: calloutData.title,
          content: calloutData.content,
        });
      } else {
        blocks.push({ type: 'markdown', content: rawMatch });
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

  const withCodeTabs = groupCodeTabs(blocks);
  const withGalleries = groupImageGalleries(withCodeTabs);
  const withSteppers = groupSteppers(
    withGalleries,
    (b) => b.type === 'step_item',
    (b) => (b as { type: 'step_item'; item: StepperItem }).item,
    (steps): ContentBlock => ({ type: 'stepper', steps })
  );

  return withSteppers;
}
