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

// Sample original-paper scan supplied for the UI-first build. Every placeholder
// page uses it until real per-year originals are uploaded (then delete this
// file and point the viewer at GET /api/me/papers/:subject/:year instead).
const SAMPLE_PAGE_URL =
  'https://res.cloudinary.com/djkpavwmp/image/upload/v1791710874/5596de5b-275d-46a5-b80e-be4d2e0c1dbd_bgdyi2.jpg';
const PAGE_COUNT = 6;

export const hasPlaceholderPaper = (): boolean => __DEV__;

export function getPlaceholderPaper(_subjectId: string, _year: number): PlaceholderPage[] {
  return Array.from({ length: PAGE_COUNT }, (_, i) => ({
    index: i,
    url: SAMPLE_PAGE_URL,
  }));
}
