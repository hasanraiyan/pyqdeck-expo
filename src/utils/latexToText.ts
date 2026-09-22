import katex from 'katex';

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ', 'k': 'ᵏ',
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
};

const toSuper = (str: string): string =>
  str.split('').map((c) => SUPERSCRIPTS[c] || `^${c}`).join('');

const toSub = (str: string): string =>
  str.split('').map((c) => SUBSCRIPTS[c] || `_${c}`).join('');

const cache = new Map<string, string>();
const MAX_CACHE = 1000;

/**
 * Converts any LaTeX math expression directly to clean Unicode text using KaTeX.
 * KaTeX parses all TeX macros, Greek letters, calculus symbols, logic, blackboard sets,
 * matrices, and environments.
 */
export function latexToUnicode(latex: string): string {
  if (!latex || !latex.trim()) return '';
  const trimmed = latex.trim();

  const cached = cache.get(trimmed);
  if (cached !== undefined) return cached;

  try {
    // KaTeX parses LaTeX into standard MathML
    const mathml = katex.renderToString(trimmed, {
      output: 'mathml',
      throwOnError: false,
    });

    // 1. Remove raw LaTeX annotation payload
    let clean = mathml.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/gi, '');

    // 2. Square roots
    clean = clean.replace(/<msqrt>([\s\S]*?)<\/msqrt>/gi, '√($1)');

    // 3. Fractions
    clean = clean.replace(/<mfrac>([\s\S]*?)<\/mfrac>/gi, '($1)');

    // 4. Matrices and tables
    clean = clean.replace(/<mtr>([\s\S]*?)<\/mtr>/gi, '$1; ');
    clean = clean.replace(/<mtd>([\s\S]*?)<\/mtd>/gi, '$1, ');

    // 5. Subscripts and superscripts
    clean = clean.replace(/<msubsup>([\s\S]*?)<\/msubsup>/gi, (_, inner) => {
      const parts = inner.match(/<m[a-z]+[^>]*>[\s\S]*?<\/m[a-z]+>/gi) || [];
      if (parts.length >= 3) {
        const base = parts[0].replace(/<[^>]+>/g, '');
        const sub = toSub(parts[1].replace(/<[^>]+>/g, ''));
        const sup = toSuper(parts[2].replace(/<[^>]+>/g, ''));
        return `${base}${sub}${sup}`;
      }
      return inner;
    });

    clean = clean.replace(/<msup>([\s\S]*?)<\/msup>/gi, (_, inner) => {
      const parts = inner.match(/<m[a-z]+[^>]*>[\s\S]*?<\/m[a-z]+>/gi) || [];
      if (parts.length >= 2) {
        const base = parts[0].replace(/<[^>]+>/g, '');
        const sup = toSuper(parts[1].replace(/<[^>]+>/g, ''));
        return `${base}${sup}`;
      }
      return inner;
    });

    clean = clean.replace(/<msub>([\s\S]*?)<\/msub>/gi, (_, inner) => {
      const parts = inner.match(/<m[a-z]+[^>]*>[\s\S]*?<\/m[a-z]+>/gi) || [];
      if (parts.length >= 2) {
        const base = parts[0].replace(/<[^>]+>/g, '');
        const sub = toSub(parts[1].replace(/<[^>]+>/g, ''));
        return `${base}${sub}`;
      }
      return inner;
    });

    // 6. Strip all remaining XML/HTML tags
    clean = clean.replace(/<[^>]+>/g, '');

    // 7. Decode standard XML entities
    clean = clean
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    // 8. Clean spaces and matrix formatting artifacts
    clean = clean
      .replace(/\s+/g, ' ')
      .replace(/,\s*;/g, ';')
      .replace(/;\s*;/g, ';')
      .replace(/,\s*\)/g, ')')
      .replace(/;\s*\)/g, ')')
      .trim();

    if (cache.size >= MAX_CACHE) {
      const first = cache.keys().next().value;
      if (first !== undefined) cache.delete(first);
    }
    cache.set(trimmed, clean);

    return clean;
  } catch (err) {
    return trimmed;
  }
}
