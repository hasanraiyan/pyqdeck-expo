// Pure helpers for uploading paper pages straight to Cloudinary (the app signs
// in with our server, then sends each page to Cloudinary itself). Kept free of
// React Native imports so they can be unit tested.

/** Overall progress, 0..1, while page `index` (0-based) of `count` is `fraction` sent. */
export function overallProgress(index: number, count: number, fraction: number): number {
  if (!(count > 0)) return 0;
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return Math.min(1, Math.max(0, (index + f) / count));
}

/**
 * Readable text for a failed Cloudinary reply. Cloudinary answers errors as
 * `{ "error": { "message": "..." } }`; anything else (an HTML error page from a
 * proxy, an empty body) falls back to the HTTP status.
 */
export function cloudinaryErrorMessage(body: unknown, status: number): string {
  const msg = (body as { error?: { message?: unknown } } | null)?.error?.message;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  return `upload rejected (HTTP ${status || 'no response'})`;
}
