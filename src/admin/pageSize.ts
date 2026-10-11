// Sizing rule for original-paper page uploads. A phone photo can be 50 MP and
// well over the server's 10 MB-per-page limit (and Cloudinary's own image
// limits), so pages are scaled down on their long edge before being sent.
// Kept pure so it can be unit tested without the image library.

export const MAX_PAGE_EDGE = 2600;

/**
 * The resize to apply, or null when the image already fits. Scales the long
 * edge to `maxEdge` and lets the library keep the aspect ratio.
 */
export function fitLongEdge(
  width: number,
  height: number,
  maxEdge: number = MAX_PAGE_EDGE
): { width: number } | { height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  if (Math.max(width, height) <= maxEdge) return null;
  return width >= height ? { width: maxEdge } : { height: maxEdge };
}
