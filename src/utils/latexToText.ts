// katex is ~0.6 MB, so it is required on first use instead of imported at launch.
let katexModule: any = null;
function getKatex() {
  if (!katexModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('katex');
    katexModule = mod.default ?? mod;
  }
  return katexModule;
}

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

interface MNode {
  tag: string;
  text: string;
  children: MNode[];
}

/** Minimal parser for the MathML string KaTeX emits (no attributes of interest). */
function parseMathML(xml: string): MNode {
  const root: MNode = { tag: 'root', text: '', children: [] };
  const stack: MNode[] = [root];
  const re = /<(\/?)([A-Za-z][\w-]*)[^>]*?(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[4] !== undefined) {
      top.text += m[4];
    } else if (m[1]) {
      if (stack.length > 1) stack.pop();
    } else {
      const node: MNode = { tag: m[2].toLowerCase(), text: '', children: [] };
      top.children.push(node);
      if (!m[3]) stack.push(node);
    }
  }
  return root;
}

const decodeEntities = (t: string): string =>
  t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

const isWrapped = (t: string): boolean => {
  if (!t.startsWith('(') || !t.endsWith(')')) return false;
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') depth++;
    else if (t[i] === ')' && --depth === 0 && i < t.length - 1) return false;
  }
  return true;
};

/** Parenthesise multi-character operands so the text stays unambiguous. */
const wrap = (t: string): string => (t.length > 1 && !isWrapped(t) ? `(${t})` : t);

const ROOT_SIGNS: Record<string, string> = { '2': '√', '3': '∛', '4': '∜' };

function mathmlToText(node: MNode): string {
  if (node.tag === 'annotation' || node.tag === 'annotation-xml') return '';
  const kids = node.children;
  const r = (n: MNode | undefined): string => (n ? mathmlToText(n) : '');
  const plain = (n: MNode | undefined): string => r(n).trim();

  switch (node.tag) {
    case 'mfrac':
      return `${wrap(plain(kids[0]))}/${wrap(plain(kids[1]))}`;
    case 'msqrt':
      return `√${wrap(kids.map(r).join('').trim())}`;
    case 'mroot': {
      const index = plain(kids[1]);
      const sign = ROOT_SIGNS[index] ?? `${toSuper(index)}√`;
      return `${sign}${wrap(plain(kids[0]))}`;
    }
    case 'msubsup':
      return `${r(kids[0])}${toSub(plain(kids[1]))}${toSuper(plain(kids[2]))}`;
    case 'msup':
      return `${r(kids[0])}${toSuper(plain(kids[1]))}`;
    case 'msub':
      return `${r(kids[0])}${toSub(plain(kids[1]))}`;
    case 'mtr':
      return `${kids.map(r).join('')}; `;
    case 'mtd':
      return `${kids.map(r).join('')}, `;
    default:
      return decodeEntities(node.text) + kids.map(r).join('');
  }
}

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
    const mathml: string = getKatex().renderToString(trimmed, {
      output: 'mathml',
      throwOnError: false,
    });

    const clean = mathmlToText(parseMathML(mathml))
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
