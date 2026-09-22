import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';
import { latexToUnicode } from './latexToText';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base guidelines based on standard mobile (375x812)
const baseWidth = 375;
const baseHeight = 812;

export const isTablet = SCREEN_WIDTH >= 768;
export const isSmallDevice = SCREEN_WIDTH < 360;

// Width breakpoints. Only meaningful on web and tablets - a phone never
// leaves 'phone' in portrait, and lands in 'tablet' at most in landscape.
export const BREAKPOINTS = { tablet: 600, laptop: 1024, desktop: 1440 } as const;

export type Breakpoint = 'phone' | 'tablet' | 'laptop' | 'desktop';

/**
 * Per-breakpoint values. Only `phone` is required; the rest cascade upward,
 * so `{ phone: 2, laptop: 4 }` means 2 on phone AND tablet, 4 from laptop up.
 */
export interface BreakpointValues<T> {
  phone: T;
  tablet?: T;
  laptop?: T;
  desktop?: T;
}

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTabletDevice = width >= 768 || (isLandscape && width >= 900);
  const isSmall = width < 360;

  const contentMaxWidth = isLandscape ? 860 : 720;
  const gridColumns = isLandscape ? (width > 900 ? 4 : 3) : (width > 600 ? 3 : 2);

  const breakpoint: Breakpoint =
    width >= BREAKPOINTS.desktop
      ? 'desktop'
      : width >= BREAKPOINTS.laptop
        ? 'laptop'
        : width >= BREAKPOINTS.tablet
          ? 'tablet'
          : 'phone';

  // `??` rather than `||` so a deliberate `false` / `0` at one breakpoint
  // isn't silently replaced by the smaller breakpoint's value.
  function bp<T>(values: BreakpointValues<T>): T {
    if (breakpoint === 'desktop')
      return values.desktop ?? values.laptop ?? values.tablet ?? values.phone;
    if (breakpoint === 'laptop') return values.laptop ?? values.tablet ?? values.phone;
    if (breakpoint === 'tablet') return values.tablet ?? values.phone;
    return values.phone;
  }

  return {
    width,
    height,
    isLandscape,
    isTablet: isTabletDevice,
    isSmallDevice: isSmall,
    contentMaxWidth,
    gridColumns,
    breakpoint,
    bp,
    // Deliberately separate from contentMaxWidth: that one is a *reading*
    // column (long prose at 1100px is unreadable), this one is for index and
    // grid screens, where wide is the whole point.
    wideMaxWidth: bp({ phone: 720, tablet: 900, laptop: 1100, desktop: 1240 }),
    // The counterpart, for prose and forms: question text, solutions,
    // settings rows. Caps out around 70-75 characters per line, which is
    // where long-form text stays comfortable to read - growing this with the
    // window would make those screens worse, not better.
    readMaxWidth: bp({ phone: 720, tablet: 680, laptop: 720, desktop: 760 }),
    hPadding: bp({ phone: 16, tablet: 24, laptop: 32, desktop: 40 }),
  };
};

/**
 * Scale horizontal sizes (padding, width, margin)
 */
export const scale = (size: number): number => {
  const newSize = (SCREEN_WIDTH / baseWidth) * size;
  if (isTablet) {
    // Clamp tablet scaling so elements don't get absurdly huge
    return Math.min(newSize, size * 1.35);
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Scale vertical sizes (heights, vertical margins)
 */
export const verticalScale = (size: number): number => {
  const newSize = (SCREEN_HEIGHT / baseHeight) * size;
  if (isTablet) {
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

/**
 * Responsive Font Size - respects system accessibility font scaling
 */
export const rf = (size: number): number => {
  const fontScale = PixelRatio.getFontScale();
  const scaled = moderateScale(size, 0.3);
  // Cap extreme font scaling to prevent UI breakage
  return Math.min(scaled * fontScale, size * 1.4);
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

  // Convert remaining standalone LaTeX symbols outside math blocks, but DO NOT
  // run underscore/caret subscripting on regular prose, snake_case, or ASCII art.
  formatted = formatLatexSymbols(formatted);

  // Restore shielded code verbatim
  formatted = formatted.replace(/\uE000(\d+)\uE001/g, (_, i) => codeBlocks[Number(i)]);

  return formatted
    // Clean excessive blank line runs (> 2 newlines)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const MAX_CONTENT_WIDTH = 720;
