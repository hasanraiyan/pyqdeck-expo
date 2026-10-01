import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';
import { latexToUnicode } from './latexToText';
import {
  LAYOUT,
  getBreakpoint,
  getShellMode,
  pickByBreakpoint,
  type BreakpointValues,
} from '../theme/layout';

// Base guidelines based on standard mobile (375x812)
const baseWidth = 375;
const baseHeight = 812;

// Snapshots at import time; prefer useResponsive() in components so they follow
// rotation and window resize.
export const isTablet = Dimensions.get('window').width >= 768;
export const isSmallDevice = Dimensions.get('window').width < 360;

// Breakpoint model, tokens and pure layout rules live in src/theme/layout.ts.
// Re-exported so existing imports from this module keep working.
export { BREAKPOINTS } from '../theme/layout';
export type { Breakpoint, BreakpointValues } from '../theme/layout';

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  // Window class comes from width alone (BP-1). The old
  // `width >= 768 || (landscape && width >= 900)` was equivalent to width >= 768.
  const isTabletDevice = width >= 768;
  const isSmall = width < 360;

  const breakpoint = getBreakpoint(width);
  const bp = <T,>(values: BreakpointValues<T>): T => pickByBreakpoint(breakpoint, values);

  return {
    width,
    height,
    isLandscape,
    isTablet: isTabletDevice,
    isSmallDevice: isSmall,
    breakpoint,
    shellMode: getShellMode(breakpoint),
    bp,
    // Deliberately separate from readMaxWidth: that one is a *reading*
    // column (long prose at 1100px is unreadable), this one is for index and
    // grid screens, where wide is the whole point.
    wideMaxWidth: bp(LAYOUT.wideMaxWidth),
    // The counterpart, for prose and forms: question text, solutions,
    // settings rows. Caps out around 70-75 characters per line, which is
    // where long-form text stays comfortable to read - growing this with the
    // window would make those screens worse, not better.
    readMaxWidth: bp(LAYOUT.readMaxWidth),
    hPadding: bp(LAYOUT.gutter),
  };
};

/**
 * Scale horizontal sizes (padding, width, margin)
 */
export const scale = (size: number): number => {
  const { width } = Dimensions.get('window');
  const newSize = (width / baseWidth) * size;
  if (width >= 768) {
    // Clamp tablet scaling so elements don't get absurdly huge
    return Math.min(newSize, size * 1.35);
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Scale vertical sizes (heights, vertical margins)
 */
export const verticalScale = (size: number): number => {
  const { width, height } = Dimensions.get('window');
  const newSize = (height / baseHeight) * size;
  if (width >= 768) {
    return Math.min(newSize, size * 1.35);
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Moderate font scaling with factor control and min/max clamp
 */
export const moderateScale = (size: number, factor = 0.5): number => {
  const newSize = size + (scale(size) - size) * factor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Highest system font scale we let text reach. Beyond this the header, cards
// and chips break on phones with "Largest" font / display size enabled.
const MAX_FONT_SCALE = 1.25;

/**
 * Responsive Font Size.
 *
 * <Text> already multiplies every fontSize by the system font scale, so this
 * must NOT multiply by it too - doing so scaled text twice (font scale 1.3
 * rendered as ~1.7x). Instead the value is pre-divided so that after <Text>
 * applies the system scale, the effective scale is clamped to MAX_FONT_SCALE.
 * Accessibility scaling still works, just capped.
 */
export const rf = (size: number): number => {
  const fontScale = PixelRatio.getFontScale();
  const scaled = moderateScale(size, 0.3);
  const effective = Math.min(fontScale, MAX_FONT_SCALE);
  return scaled * (effective / fontScale);
};

/**
 * Converts any LaTeX math expression directly to clean Unicode text using KaTeX.
 * Fully powered by KaTeX's official parser (all symbols, macros, matrices, roots, etc.).
 */
export const formatLatexSymbols = (expr: string): string => latexToUnicode(expr);
export const formatMathExpression = (expr: string): string => latexToUnicode(expr);

/**
 * Cleans escaped newlines and formats LaTeX math blocks ($...$, $$...$$) into clean unicode math
 */
export const cleanMarkdown = (text: string | null | undefined): string => {
  if (!text) return '';
  
  let formatted = text
    // Replace literal escaped "\n" or "\\n" strings with actual newlines
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    // Normalize raw HTML breaks and horizontal rules
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // Shield fenced/inline code (SQL, identifiers like `customer_data`) from the
  // math/subscript rewriting below - `_id` etc. is code syntax, not LaTeX.
  const codeBlocks: string[] = [];
  formatted = formatted.replace(/```[\s\S]*?```|`[^`\n]+`/g, (block) => {
    codeBlocks.push(block);
    return `\uE000${codeBlocks.length - 1}\uE001`;
  });

  // Convert display math $$...$$ and inline math $...$ in a single pass.
  // Doing these as two separate .replace() calls (display first, then
  // inline) meant the inline pass re-scanned the *already-converted* output
  // - the backticks and $$ that display math had just inserted were not
  // shielded, so the inline regex partially re-matched them and produced
  // corrupted, nested-backtick output (e.g. `` `$`$ E=mc^2 $`$` ``). One
  // pass with $$...$$ tried before $...$ in the alternation (so it wins at
  // any position where both could start) avoids that entirely.
  formatted = formatted.replace(
    /\$\$([\s\S]*?)\$\$|\$([^\$\n]+)\$/g,
    (_, display, inline) =>
      display !== undefined
        ? `\n\n\`$$ ${formatMathExpression(display)} $$\`\n\n`
        : `\`$ ${formatMathExpression(inline)} $\``
  );

  // Restore shielded code verbatim
  formatted = formatted.replace(/\uE000(\d+)\uE001/g, (_, i) => codeBlocks[Number(i)]);

  return formatted
    // Clean excessive blank line runs (> 2 newlines)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

