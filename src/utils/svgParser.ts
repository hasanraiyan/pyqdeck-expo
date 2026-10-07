export interface SvgData {
  xml: string;
  title?: string;
  aspectRatio: number;
  width?: number;
  height?: number;
}

/**
 * Extracts viewBox dimensions or width/height attributes from raw SVG XML.
 */
export function extractSvgDimensions(xml: string): { aspectRatio: number; width?: number; height?: number } {
  if (!xml) return { aspectRatio: 16 / 9 };

  // Match viewBox="min-x min-y width height"
  const viewBoxMatch = xml.match(/viewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (viewBoxMatch) {
    const w = parseFloat(viewBoxMatch[3]);
    const h = parseFloat(viewBoxMatch[4]);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      const ratio = w / h;
      return {
        aspectRatio: Math.max(0.4, Math.min(3.5, ratio)),
        width: w,
        height: h,
      };
    }
  }

  // Fallback to width and height attributes
  const widthMatch = xml.match(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i);
  const heightMatch = xml.match(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i);
  if (widthMatch && heightMatch) {
    const w = parseFloat(widthMatch[1]);
    const h = parseFloat(heightMatch[1]);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      return {
        aspectRatio: Math.max(0.4, Math.min(3.5, w / h)),
        width: w,
        height: h,
      };
    }
  }

  return { aspectRatio: 16 / 9 };
}

/**
 * Extracts <title>...</title> inside the SVG if present.
 */
export function extractSvgTitle(xml: string): string | undefined {
  if (!xml) return undefined;
  const match = xml.match(/<title\b[^>]*>(.*?)<\/title>/i);
  return match && match[1] ? match[1].trim() : undefined;
}

/**
 * react-native-svg's Android MarkerView does Double.parseDouble() on `orient`,
 * so `auto-start-reverse` throws NumberFormatException and kills the app.
 * Only numeric angles and `auto` are safe natively.
 */
export function sanitizeSvgForNative(xml: string): string {
  return xml.replace(
    /(\borient\s*=\s*)(["'])\s*auto-start-reverse\s*\2/gi,
    '$1$2auto$2'
  );
}

/**
 * Regex matching standalone <svg>...</svg> tags.
 */
export const RAW_SVG_REGEX =
  /(?:^|\r?\n)<svg\b[^>]*>([\s\S]*?)<\/svg>/gi;

/**
 * Parses and sanitizes SVG XML for rendering.
 */
export function parseSvgContent(rawXml: string, fallbackTitle?: string): SvgData | null {
  if (!rawXml) return null;
  const trimmed = rawXml.trim();
  if (!trimmed.toLowerCase().includes('<svg') || !trimmed.toLowerCase().includes('</svg>')) {
    return null;
  }

  // Ensure valid starting <svg tag
  const svgStartIndex = trimmed.search(/<svg\b/i);
  const svgEndIndex = trimmed.toLowerCase().lastIndexOf('</svg>');
  if (svgStartIndex === -1 || svgEndIndex === -1 || svgEndIndex <= svgStartIndex) {
    return null;
  }

  const cleanXml = trimmed.substring(svgStartIndex, svgEndIndex + 6);
  const { aspectRatio, width, height } = extractSvgDimensions(cleanXml);
  const title = fallbackTitle || extractSvgTitle(cleanXml);

  return {
    xml: cleanXml,
    title,
    aspectRatio,
    width,
    height,
  };
}
