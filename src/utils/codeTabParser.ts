export interface CodeTabItem {
  label: string;
  language: string;
  code: string;
}

const LANGUAGE_LABEL_MAP: Record<string, string> = {
  java: 'Java',
  py: 'Python',
  python: 'Python',
  cpp: 'C++',
  'c++': 'C++',
  c: 'C',
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  cs: 'C#',
  csharp: 'C#',
  go: 'Go',
  golang: 'Go',
  rust: 'Rust',
  rs: 'Rust',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  swift: 'Swift',
  sql: 'SQL',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  r: 'R',
  php: 'PHP',
  ruby: 'Ruby',
  rb: 'Ruby',
  dart: 'Dart',
};

/**
 * Returns a human-friendly language name (e.g. "py" -> "Python", "cpp" -> "C++").
 */
export function getLanguageLabel(lang: string): string {
  const clean = (lang || '').trim().toLowerCase();
  if (LANGUAGE_LABEL_MAP[clean]) {
    return LANGUAGE_LABEL_MAP[clean];
  }
  if (!clean || clean === 'text' || clean === 'txt' || clean === 'code') {
    return 'Code';
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Attempts to extract a tab title from the first comment line of the code.
 * e.g. "// Approach 1: Iterative" or "# Recursive"
 */
function extractTitleFromComment(code: string): string | null {
  const firstLine = code.trim().split(/\r?\n/)[0] || '';
  const match = firstLine.match(/^(?:\/\/|#|\/\*)\s*(?:Approach\s*\d*[:.]?\s*)?([A-Za-z0-9_\- ]{2,30}?)(?:\*\/|$)/i);
  if (!match || !match[1]) return null;
  const candidate = match[1].trim();
  const lower = candidate.toLowerCase();
  if (['java', 'python', 'cpp', 'c', 'include', 'import', 'package', 'public', 'def', 'class'].includes(lower)) {
    return null;
  }
  return candidate;
}

const HEADING_ONLY_REGEX = /^#{2,4}\s+(.+)$/;

/**
 * Scans content blocks and automatically merges:
 * 1. Back-to-back code blocks (multi-language variants)
 * 2. Headed code blocks (e.g. "### Approach 1: Iterative", followed by code)
 * into a single unified `code_tabs` block.
 */
export function groupCodeTabs<T extends { type: string; [key: string]: any }>(blocks: T[]): T[] {
  if (!Array.isArray(blocks) || blocks.length < 2) return blocks;

  const result: T[] = [];
  let i = 0;

  while (i < blocks.length) {
    // 1. Headed Code Blocks:
    // (heading, code) followed by at least one more (heading, code)
    if (
      blocks[i].type === 'markdown' &&
      typeof blocks[i].content === 'string' &&
      HEADING_ONLY_REGEX.test(blocks[i].content.trim()) &&
      i + 1 < blocks.length &&
      blocks[i + 1].type === 'code'
    ) {
      let j = i;
      const candidates: CodeTabItem[] = [];

      while (
        j < blocks.length &&
        blocks[j].type === 'markdown' &&
        typeof blocks[j].content === 'string' &&
        HEADING_ONLY_REGEX.test(blocks[j].content.trim()) &&
        j + 1 < blocks.length &&
        blocks[j + 1].type === 'code'
      ) {
        const headingMatch = blocks[j].content.trim().match(HEADING_ONLY_REGEX);
        const headingText = headingMatch ? headingMatch[1].trim() : `Tab ${candidates.length + 1}`;
        candidates.push({
          label: headingText,
          language: blocks[j + 1].language,
          code: blocks[j + 1].code,
        });
        j += 2;
      }

      if (candidates.length >= 2) {
        result.push({
          type: 'code_tabs',
          tabs: candidates,
        } as unknown as T);
        i = j;
        continue;
      }
    }

    // 2. Direct Consecutive Code Blocks:
    if (blocks[i].type === 'code') {
      let j = i;
      const codeTabs: CodeTabItem[] = [];

      while (j < blocks.length && blocks[j].type === 'code') {
        const itemCode = blocks[j].code || '';
        const itemLang = blocks[j].language || 'text';
        const commentTitle = extractTitleFromComment(itemCode);
        const label = commentTitle || getLanguageLabel(itemLang);

        codeTabs.push({
          label,
          language: itemLang,
          code: itemCode,
        });
        j++;
      }

      if (codeTabs.length >= 2) {
        // Disambiguate if duplicate labels exist (e.g. Python & Python)
        const counts: Record<string, number> = {};
        for (const t of codeTabs) {
          counts[t.label] = (counts[t.label] || 0) + 1;
        }

        const seen: Record<string, number> = {};
        const disambiguatedTabs = codeTabs.map((t) => {
          if (counts[t.label] > 1) {
            seen[t.label] = (seen[t.label] || 0) + 1;
            return { ...t, label: `${t.label} ${seen[t.label]}` };
          }
          return t;
        });

        result.push({
          type: 'code_tabs',
          tabs: disambiguatedTabs,
        } as unknown as T);
        i = j;
        continue;
      }
    }

    result.push(blocks[i]);
    i++;
  }

  return result;
}
