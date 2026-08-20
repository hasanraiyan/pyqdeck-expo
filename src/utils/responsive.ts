import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base guidelines based on standard mobile (375x812)
const baseWidth = 375;
const baseHeight = 812;

export const isTablet = SCREEN_WIDTH >= 768;
export const isSmallDevice = SCREEN_WIDTH < 360;

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
 * Cleans escaped newlines and markdown artifacts from backend responses
 */
export const cleanMarkdown = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    // Replace literal escaped "\n" or "\\n" strings with actual newlines
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    // Clean excessive blank line runs (> 2 newlines)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const MAX_CONTENT_WIDTH = 720;
