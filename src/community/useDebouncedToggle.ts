import { useCallback, useEffect, useRef } from 'react';

/**
 * Twitter / LinkedIn / YouTube-style debounced toggle hook.
 *
 * How it works:
 *   1. Every tap immediately invokes `onOptimistic(nextValue)` so the UI feels
 *      instant — the icon flips right away with no waiting.
 *   2. A debounce timer (default 500 ms) is (re)started on each tap. Rapid
 *      like→unlike→like taps cancel and restart the timer each time.
 *   3. When the timer fires — i.e. the user has stopped tapping — the *final*
 *      state is committed by calling `onCommit(finalValue)`. Only one network
 *      request ever goes out per burst of taps, regardless of how many times
 *      the user tapped.
 *   4. On unmount any pending commit is flushed synchronously so a quick tap
 *      then navigation doesn't silently drop the action.
 *
 * Usage:
 *   const tap = useDebouncedToggle({
 *     current: post.isLiked,
 *     onOptimistic: (liked) => patchPostLocally(post.id, liked),
 *     onCommit:     (liked) => liked ? api.like(id) : api.unlike(id),
 *   });
 *   <LikeButton onPress={tap} />
 */
export function useDebouncedToggle({
  current,
  onOptimistic,
  onCommit,
  delay = 500,
}: {
  /** The current server-truth value (e.g. `post.isLiked`). */
  current: boolean;
  /**
   * Called synchronously on every tap with the new toggled value.
   * Update local/optimistic UI here (patch the query cache, setState, etc.).
   */
  onOptimistic: (next: boolean) => void;
  /**
   * Called once per burst of taps (after `delay` ms of silence) with the
   * final value. Perform the actual API call here.
   * May be async; errors should be handled inside (restore + alert).
   */
  onCommit: (final: boolean) => void | Promise<void>;
  /** Debounce window in milliseconds. Default: 500. */
  delay?: number;
}): () => void {
  // Track the pending "final" value between taps so we know what to commit.
  // `null` means no pending commit — the server is already in sync.
  const pendingRef = useRef<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onCommit);
  const delayRef = useRef(delay);

  // Keep refs in sync so the closure inside tap() always sees the latest callbacks.
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);
  useEffect(() => { delayRef.current = delay; }, [delay]);

  // Flush any in-flight commit on unmount (e.g. user taps like then navigates away).
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        if (pendingRef.current !== null) {
          void onCommitRef.current(pendingRef.current);
          pendingRef.current = null;
        }
      }
    };
  }, []);

  const tap = useCallback(() => {
    // What would the next value be? If there's a pending tap it toggles from
    // that, otherwise it toggles from the server-truth value.
    const next =
      pendingRef.current !== null ? !pendingRef.current : !current;

    // 1 — instant UI
    onOptimistic(next);

    // 2 — record what we want to commit
    pendingRef.current = next;

    // 3 — (re)start the debounce timer
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const final = pendingRef.current;
      pendingRef.current = null;
      if (final !== null) void onCommitRef.current(final);
    }, delayRef.current);
  }, [current, onOptimistic]);
  // NOTE: `current` intentionally in deps so `!current` is always correct for
  // the first tap in a burst. Subsequent taps within the burst use `pendingRef`
  // which is independent of re-renders.

  return tap;
}
