import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base guidelines based on standard mobile (375x812)
const baseWidth = 375;
const baseHeight = 812;

export const isTablet = SCREEN_WIDTH >= 768;
export const isSmallDevice = SCREEN_WIDTH < 360;

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTabletDevice = width >= 768 || (isLandscape && width >= 900);
  const isSmall = width < 360;

  const contentMaxWidth = isLandscape ? 860 : 720;
  const gridColumns = isLandscape ? (width > 900 ? 4 : 3) : (width > 600 ? 3 : 2);

  return {
    width,
    height,
    isLandscape,
    isTablet: isTabletDevice,
    isSmallDevice: isSmall,
    contentMaxWidth,
    gridColumns,
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

const formatMathExpression = (expr: string): string => {
  return expr
    // Common LaTeX symbols
    .replace(/\\theta/gi, 'θ')
    .replace(/\\omega/gi, 'ω')
    .replace(/\\alpha/gi, 'α')
    .replace(/\\beta/gi, 'β')
    .replace(/\\gamma/gi, 'γ')
    .replace(/\\delta/gi, 'δ')
    .replace(/\\lambda/gi, 'λ')
    .replace(/\\mu/gi, 'μ')
    .replace(/\\pi/gi, 'π')
    .replace(/\\sigma/gi, 'σ')
    .replace(/\\tau/gi, 'τ')
    .replace(/\\phi/gi, 'φ')
    .replace(/\\psi/gi, 'ψ')
    .replace(/\\infty/gi, '∞')
    .replace(/\\approx/gi, '≈')
    .replace(/\\neq/gi, '≠')
    .replace(/\\leq/gi, '≤')
    .replace(/\\geq/gi, '≥')
    .replace(/\\times/gi, '×')
    .replace(/\\div/gi, '÷')
    .replace(/\\pm/gi, '±')
    .replace(/\\cdot/gi, '·')
    .replace(/\\in/gi, '∈')
    .replace(/\\subset/gi, '⊂')
    .replace(/\\cup/gi, '∪')
    .replace(/\\cap/gi, '∩')
    .replace(/\\rightarrow/gi, '→')
    .replace(/\\leftarrow/gi, '←')
    .replace(/\\leftrightarrow/gi, '↔')
    .replace(/\\Rightarrow/gi, '⇒')
    .replace(/\\Leftarrow/gi, '⇐')
    .replace(/\\sqrt\{([^}]+)\}/gi, '√($1)')
    .replace(/\\sqrt/gi, '√')
    // Fractions \frac{a}{b} -> (a / b)
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/gi, '($1 / $2)')
    // Text blocks \text{...} -> ...
    .replace(/\\text\{([^}]+)\}/gi, '$1')
    .replace(/\\mathrm\{([^}]+)\}/gi, '$1')
    .replace(/\\mathbf\{([^}]+)\}/gi, '$1')
    // Superscripts x^{2} or x^2
    .replace(/\^{([^}]+)}/g, (_, p1) =>
      p1.split('').map((c: string) => SUPERSCRIPTS[c] || c).join('')
    )
    .replace(/\^([0-9a-zA-Z+-])/g, (_, p1) => SUPERSCRIPTS[p1] || `^${p1}`)
    // Subscripts x_{i} or x_i
    .replace(/_{([^}]+)}/g, (_, p1) =>
      p1.split('').map((c: string) => SUBSCRIPTS[c] || c).join('')
    )
    .replace(/_([0-9a-zA-Z+-])/g, (_, p1) => SUBSCRIPTS[p1] || `_${p1}`)
    .trim();
};

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

  // Convert display math $$...$$
  formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    return `\n\n\`$$ ${formatMathExpression(math)} $$\`\n\n`;
  });

  // Convert inline math $...$
  formatted = formatted.replace(/\$([^\$\n]+)\$/g, (_, math) => {
    return `\`$ ${formatMathExpression(math)} $\``;
  });

  // Convert remaining single LaTeX commands outside math blocks
  formatted = formatMathExpression(formatted);

  return formatted
    // Clean excessive blank line runs (> 2 newlines)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const MAX_CONTENT_WIDTH = 720;
