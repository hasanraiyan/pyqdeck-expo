// @ts-ignore - mathjax-full internal imports
import { mathjax } from 'mathjax-full/js/mathjax.js';
// @ts-ignore
import { TeX } from 'mathjax-full/js/input/tex.js';
// @ts-ignore
import { SVG } from 'mathjax-full/js/output/svg.js';
// @ts-ignore
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
// @ts-ignore
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';

// Import only essential math packages to minimize JS bundle size (avoids heavy chemistry/physics/buss trees)
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/amscd/AmsCdConfiguration.js';
import 'mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js';
import 'mathjax-full/js/input/tex/mathtools/MathtoolsConfiguration.js';
import 'mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import 'mathjax-full/js/input/tex/cases/CasesConfiguration.js';
import 'mathjax-full/js/input/tex/color/ColorConfiguration.js';
import 'mathjax-full/js/input/tex/extpfeil/ExtpfeilConfiguration.js';
import 'mathjax-full/js/input/tex/noerrors/NoErrorsConfiguration.js';
import 'mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js';
import 'mathjax-full/js/input/tex/unicode/UnicodeConfiguration.js';

const MATH_PACKAGES = [
  'base',
  'ams',
  'amscd',
  'newcommand',
  'mathtools',
  'boldsymbol',
  'cases',
  'color',
  'extpfeil',
  'noerrors',
  'noundefined',
  'unicode',
];

export interface SvgMathResult {
  xml: string;
  width: number;
  height: number;
  verticalAlign: number;
  aspectRatio: number;
}

export interface TexToSvgOptions {
  displayMode?: boolean;
  color?: string;
  fontSize?: number;
}

let adaptor: any = null;
let mathDocument: any = null;

function ensureInitialized() {
  if (adaptor && mathDocument) return;

  adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);

  mathDocument = mathjax.document('', {
    InputJax: new TeX({ packages: MATH_PACKAGES }),
    OutputJax: new SVG({ fontCache: 'none' }),
  });
}

// 1ex is approx 0.4423em (font size)
const EX_TO_PX = 0.4423;

const SVG_CACHE_MAX = 500;
const svgCache = new Map<string, SvgMathResult>();

/**
 * Converts a LaTeX formula into a native SVG XML string with dimensions and baseline alignment.
 * 100% native vector math, zero WebViews.
 */
export function texToSvg(tex: string, options: TexToSvgOptions = {}): SvgMathResult {
  const { displayMode = false, color, fontSize = 16 } = options;
  const cacheKey = `${displayMode ? 'D:' : 'I:'}${fontSize}:${color || ''}:${tex.trim()}`;

  const cached = svgCache.get(cacheKey);
  if (cached) {
    svgCache.delete(cacheKey);
    svgCache.set(cacheKey, cached);
    return cached;
  }

  ensureInitialized();

  try {
    const node = mathDocument.convert(tex.trim(), { display: displayMode });
    let svg = adaptor.outerHTML(node);

    // Strip surrounding <mjx-container>
    const svgStart = svg.indexOf('<svg');
    const svgEnd = svg.lastIndexOf('</svg>');
    if (svgStart !== -1 && svgEnd !== -1) {
      svg = svg.slice(svgStart, svgEnd + 6);
    }

    // Apply color if specified
    if (color) {
      svg = svg.replace('<svg', `<svg fill="${color}"`);
    }

    const wMatch = svg.match(/width="([\d.]+)ex"/);
    const hMatch = svg.match(/height="([\d.]+)ex"/);
    const vMatch = svg.match(/vertical-align:\s*([-\d.]+)ex/);

    const widthEx = wMatch?.[1] ? parseFloat(wMatch[1]) : 1;
    const heightEx = hMatch?.[1] ? parseFloat(hMatch[1]) : 1;
    const verticalAlignEx = vMatch?.[1] ? parseFloat(vMatch[1]) : 0;

    const pxPerEx = fontSize * EX_TO_PX;
    const width = Math.max(Math.ceil(widthEx * pxPerEx), 4);
    const height = Math.max(Math.ceil(heightEx * pxPerEx), 4);
    const verticalAlign = verticalAlignEx * pxPerEx;
    const aspectRatio = width / height;

    const result: SvgMathResult = {
      xml: svg,
      width,
      height,
      verticalAlign,
      aspectRatio,
    };

    if (svgCache.size >= SVG_CACHE_MAX) {
      const first = svgCache.keys().next().value;
      if (first !== undefined) svgCache.delete(first);
    }
    svgCache.set(cacheKey, result);

    return result;
  } catch (err) {
    // Fallback minimal error SVG
    const fallback: SvgMathResult = {
      xml: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><text y="15" fill="red" font-size="12">LaTeX Error</text></svg>`,
      width: 40,
      height: 20,
      verticalAlign: 0,
      aspectRatio: 2,
    };
    return fallback;
  }
}

export type MathSegment =
  | { type: 'text'; content: string }
  | { type: 'math'; content: string; display: boolean };

const MATH_TOKEN_REGEX =
  /(`\$\$[\s\S]*?\$\$`|`\$[^\n]*?\$`|\$\$[\s\S]*?\$\$|\$[^\n$]*?\$|\\\[[\s\S]*?\\\]|\\\([^)]*?\\\))/g;

/**
 * Splits text into alternating text and math segments
 */
export function splitTextAndMath(text: string): MathSegment[] {
  if (!text) return [];

  const rawParts = text.split(MATH_TOKEN_REGEX);
  const segments: MathSegment[] = [];

  for (const part of rawParts) {
    if (!part) continue;

    const trimmed = part.trim();
    const isDisplay =
      (trimmed.startsWith('$$') && trimmed.endsWith('$$')) ||
      (trimmed.startsWith('`$$') && trimmed.endsWith('$$`')) ||
      (trimmed.startsWith('\\[') && trimmed.endsWith('\\]'));

    const isInline =
      (trimmed.startsWith('$') && trimmed.endsWith('$')) ||
      (trimmed.startsWith('`$') && trimmed.endsWith('$`')) ||
      (trimmed.startsWith('\\(') && trimmed.endsWith('\\)'));

    if (isDisplay) {
      const math = trimmed
        .replace(/^`/, '')
        .replace(/`$/, '')
        .replace(/^\$\$/, '')
        .replace(/\$\$$/, '')
        .replace(/^\\\[/, '')
        .replace(/\\\]$/, '')
        .trim();
      segments.push({ type: 'math', content: math, display: true });
    } else if (isInline) {
      const math = trimmed
        .replace(/^`/, '')
        .replace(/`$/, '')
        .replace(/^\$/, '')
        .replace(/\$$/, '')
        .replace(/^\\\(/, '')
        .replace(/\\\)$/, '')
        .trim();
      segments.push({ type: 'math', content: math, display: false });
    } else {
      segments.push({ type: 'text', content: part });
    }
  }

  return segments;
}
