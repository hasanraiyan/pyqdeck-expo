import { Marked } from 'marked';
import katex from 'katex';

// Escape raw HTML in source text to neutralize untrusted OCR/import HTML
const escapeHtml = (s: string): string =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c
  );

const marked = new Marked({ gfm: true, breaks: true });
marked.use({
  renderer: {
    html({ raw }) {
      return escapeHtml(raw);
    },
  },
});

export const normalizeLineBreaks = (text: string): string =>
  text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

export const renderMath = (expr: string, displayMode: boolean): string => {
  try {
    return katex.renderToString(expr, {
      throwOnError: false,
      displayMode,
      strict: 'ignore',
    });
  } catch {
    // Fall back to showing raw delimiters if expression completely fails
    return escapeHtml(displayMode ? `$$${expr}$$` : `$${expr}$`);
  }
};

// Sentinel wrapper built from Unicode Private Use Area code points (U+E000 / U+E001)
const PUA_START = String.fromCodePoint(0xe000);
const PUA_END = String.fromCodePoint(0xe001);
const TOKEN_RE = new RegExp(PUA_START + '(\\d+)' + PUA_END, 'g');

// Bounded LRU cache for rendered HTML
const HTML_CACHE_MAX = 500;
const htmlCache = new Map<string, string>();

const getCachedHtml = (key: string): string | undefined => {
  const v = htmlCache.get(key);
  if (v !== undefined) {
    htmlCache.delete(key);
    htmlCache.set(key, v);
    return v;
  }
  return undefined;
};

const setCachedHtml = (key: string, val: string) => {
  if (htmlCache.has(key)) {
    htmlCache.delete(key);
  } else if (htmlCache.size >= HTML_CACHE_MAX) {
    const first = htmlCache.keys().next().value;
    if (first !== undefined) htmlCache.delete(first);
  }
  htmlCache.set(key, val);
};

/**
 * Parses raw markdown containing LaTeX math ($...$, $$...$$, \(...\), \[...\])
 * completely client-side in Expo using KaTeX + Marked into full HTML.
 */
export const renderMarkdownMath = (text: string | null | undefined): string => {
  if (!text) return '';
  const cached = getCachedHtml(text);
  if (cached !== undefined) return cached;

  const placeholders: string[] = [];
  const stash = (html: string) => {
    const token = PUA_START + placeholders.length + PUA_END;
    placeholders.push(html);
    return token;
  };

  // 1. Shield code blocks from math parsing
  const codeBlocks: string[] = [];
  const stashCode = (code: string) => {
    const token = `\uE002${codeBlocks.length}\uE003`;
    codeBlocks.push(code);
    return token;
  };

  let formatted = normalizeLineBreaks(text)
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // Stash fenced code blocks (```...```) first
  formatted = formatted.replace(/```[\s\S]*?```/g, stashCode);

  // 2. Display math ($$...$$, `$$...$$`, \[...\])
  formatted = formatted
    .replace(/`\$\$([\s\S]+?)\$\$`/g, (_, expr) => stash(renderMath(expr.trim(), true)))
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => stash(renderMath(expr.trim(), true)))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => stash(renderMath(expr.trim(), true)));

  // 3. Inline math ($...$, `$...$`, \(...\))
  formatted = formatted
    .replace(/`\$([^$\n]+?)\$`/g, (_, expr) => stash(renderMath(expr.trim(), false)))
    .replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, expr) => stash(renderMath(expr.trim(), false)))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => stash(renderMath(expr.trim(), false)));

  // 4. Restore code blocks before markdown parsing
  formatted = formatted.replace(/\uE002(\d+)\uE003/g, (_, i) => codeBlocks[Number(i)]);

  // 5. Parse Markdown
  const parsedMarkdown = marked.parse(formatted) as string;

  // 6. Splice rendered KaTeX HTML back into placeholders
  const out = parsedMarkdown.replace(TOKEN_RE, (_, i) => placeholders[Number(i)]);

  setCachedHtml(text, out);
  return out;
};
