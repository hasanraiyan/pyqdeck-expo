/**
 * Client-side search abuse guards for SearchScreen.
 * No deps, in-memory token bucket + validation.
 * Keeps 429 signal visible instead of silently falling back to offline cache.
 */

const MIN_LEN = 2;
// Long enough for a whole scanned exam question (see scanText.ts).
export const MAX_LEN = 200;

// Token bucket: burst 5, sustained 1 per 2s = 30/min
const CAPACITY = 5;
const REFILL_PER_SEC = 0.5;

let tokens = CAPACITY;
let lastRefill = Date.now();
let lastSearchTap = 0;
let blockedUntil = 0;

function refill() {
  const now = Date.now();
  if (blockedUntil && now < blockedUntil) return;
  if (blockedUntil && now >= blockedUntil) blockedUntil = 0;
  const elapsedSec = (now - lastRefill) / 1000;
  tokens = Math.min(CAPACITY, tokens + elapsedSec * REFILL_PER_SEC);
  lastRefill = now;
}

export function canSearch(): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (blockedUntil && now < blockedUntil) {
    return { allowed: false, retryAfterSec: Math.ceil((blockedUntil - now) / 1000) };
  }
  refill();
  if (tokens >= 1) return { allowed: true, retryAfterSec: 0 };
  const needed = 1 - tokens;
  const retryAfterSec = Math.ceil(needed / REFILL_PER_SEC);
  return { allowed: false, retryAfterSec };
}

export function consumeSearchToken(): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (blockedUntil && now < blockedUntil) {
    return { allowed: false, retryAfterSec: Math.ceil((blockedUntil - now) / 1000) };
  }
  refill();
  if (tokens < 1) {
    const needed = 1 - tokens;
    return { allowed: false, retryAfterSec: Math.ceil(needed / REFILL_PER_SEC) };
  }
  tokens -= 1;
  return { allowed: true, retryAfterSec: 0 };
}

/** 300ms rapid-tap debounce for suggestion rows */
export function shouldDebounceTap(): boolean {
  const now = Date.now();
  if (now - lastSearchTap < 300) return true;
  lastSearchTap = now;
  return false;
}

export type Normalized = { ok: true; query: string } | { ok: false; error: string };

export function normalizeQuery(raw: string): Normalized {
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  if (collapsed.length === 0) return { ok: false, error: 'Enter a search term' };
  if (collapsed.length < MIN_LEN) return { ok: false, error: `Type at least ${MIN_LEN} characters` };
  if (collapsed.length > MAX_LEN) return { ok: false, error: `Max ${MAX_LEN} characters (you typed ${collapsed.length})` };
  if (!/[a-zA-Z0-9]/.test(collapsed)) return { ok: false, error: 'Add some letters or numbers' };
  return { ok: true, query: collapsed };
}

/** Call when server returns 429 — block bucket for Retry-After */
export function applyServerRetryAfter(retryAfterSec: number) {
  const sec = Math.max(1, Math.min(60, Math.round(retryAfterSec || 15)));
  blockedUntil = Date.now() + sec * 1000;
  tokens = 0;
  lastRefill = Date.now();
}

// test helper — reset between tests / manual QA
export function __resetBucket() {
  tokens = CAPACITY;
  lastRefill = Date.now();
  lastSearchTap = 0;
  blockedUntil = 0;
}

// OCR text is multi-line and noisy. Flatten it to one line and cut it to the
// search limit on a word boundary so the cut never lands mid-word.
export function toSearchQuery(raw: string, maxLen = MAX_LEN): string {
  const flat = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\s.,?()+\-*/=%^'"]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= maxLen) return flat;
  const cut = flat.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

// A scan that read only a few words usually means the crop was too loose or
// the photo too blurry: worth a "crop closer" nudge.
export function isLowText(text: string): boolean {
  const t = text.trim();
  return t.length < 12 || t.split(/\s+/).length < 3;
}
