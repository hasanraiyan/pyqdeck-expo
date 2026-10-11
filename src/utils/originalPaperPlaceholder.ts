/**
 * TEMPORARY placeholder for original paper pages (docs/SRS-original-paper-viewer.md).
 *
 * No original scans exist in the system yet, so the viewer UI is built against
 * fake page images. This module is the ONLY place that knows about them:
 *  - `hasPlaceholderPaper()` is true in dev builds only, so release builds
 *    never show the "View original paper" button until the real backend lands;
 *  - `getPlaceholderPaper()` returns stable fake page URLs for any subject/year.
 *
 * Delete this file when the real `GET /api/me/papers/:subject/:year` endpoint
 * lands and point the viewer at it instead (FR-PAPER-13).
 */

export interface PlaceholderPage {
  index: number;
  url: string;
}

// Sample original-paper scan pages supplied for the UI-first build. Just the
// 2 pages below until real per-year originals are uploaded (then delete this
// file and point the viewer at GET /api/me/papers/:subject/:year instead).
const SAMPLE_PAGE_URLS = [
  'https://res.cloudinary.com/djkpavwmp/image/upload/v1791713413/WhatsApp_Image_2026-10-11_at_3.39.25_PM_b5umiz.jpg',
  'https://res.cloudinary.com/djkpavwmp/image/upload/v1791713413/WhatsApp_Image_2026-10-11_at_3.39.25_PM_1_p8hrww.jpg',
];

export const hasPlaceholderPaper = (): boolean => __DEV__;

export function getPlaceholderPaper(_subjectId: string, _year: number): PlaceholderPage[] {
  return SAMPLE_PAGE_URLS.map((url, i) => ({ index: i, url }));
}
