import type { QueryClient } from '@tanstack/react-query';

// Admins must never read their own change back from a cache.
//
// Between the phone and the database there are four caches: React Query (12h for
// catalog data), the platform HTTP cache, Cloudflare (public GETs live for up to
// an hour) and each origin's in-memory cache (an admin write clears only the
// origin that served it). Fixing one leaves the other three serving the old row.
//
// So, for admins only:
//   1. every public GET carries a unique `fresh` param -> skips every HTTP cache
//   2. every successful admin write invalidates the React Query cache
// Students are untouched: they keep the cheap cached path.

let adminReads = false;
let lastWriteAt = 0;

// A write also busts reads for a while on non-admin-flagged sessions (the admin
// check is async, so the first screen can load before it resolves).
const AFTER_WRITE_MS = 10 * 60 * 1000;

export function setAdminFreshReads(on: boolean): void {
  adminReads = on;
}

export function markAdminWrite(): void {
  lastWriteAt = Date.now();
}

/** Timestamp to use as the cache-busting `fresh` value, or null for a normal cached read. */
export function freshStamp(): number | null {
  if (adminReads || Date.now() - lastWriteAt < AFTER_WRITE_MS) return Date.now();
  return null;
}

export function withFresh(path: string): string {
  const stamp = freshStamp();
  if (stamp === null || /[?&]fresh=/.test(path)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}fresh=${stamp}`;
}

/**
 * Mark everything an edit could touch as stale and refetch what is on screen.
 * Only billed AI answers and per-account vote state are left alone.
 */
export function invalidateAfterAdminWrite(queryClient: QueryClient): void {
  markAdminWrite();
  void queryClient.invalidateQueries({
    predicate: (q) => {
      const [root, second] = q.queryKey as unknown[];
      if (root === 'noteVotes') return false;
      if (root === 'search' && typeof second === 'string' && second.startsWith('ai')) return false;
      return true;
    },
  });
}
