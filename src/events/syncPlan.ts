/**
 * Pure planning for the sync coordinator (docs/SRS-event-driven-architecture.md,
 * SYN-FR-2/3). Events that want a sync are collected as a REASON SET; this works
 * out how long to wait before the one round that serves them all. No timers, no
 * storage, so it runs under `node --test`.
 */

import type { SyncHints } from '../config/appConfigLogic';

export type SyncReason =
  | 'progress' // a topic was ticked
  | 'recents' // Jump Back In changed
  | 'setting' // an account setting changed
  | 'foreground'
  | 'network' // the connection came back
  | 'nudge' // another device changed something
  | 'auth' // signed in / token resumed
  | 'background' // leaving the app: send what is queued now
  | 'study-open' // the Study tab opened
  | 'manual' // a caller asked outright (refresh from cloud, flush)
  | 'followup'; // the engine's own "one more round"

export const DEBOUNCE_MS = 2_000;
export const MAX_WAIT_MS = 30_000;

/**
 * Reasons that only mean "the app woke up or heard something". They are the ones
 * that pile up (foreground + network + nudge together), so a round started by
 * nothing else keeps a minimum gap from the previous one.
 */
const SOFT: ReadonlySet<SyncReason> = new Set<SyncReason>([
  'foreground',
  'network',
  'nudge',
  'study-open',
]);

/** How long this one reason is willing to wait. */
export function reasonDelay(
  reason: SyncReason,
  hints: SyncHints,
  debounceMs: number = DEBOUNCE_MS
): number {
  switch (reason) {
    case 'background':
      return 0; // the OS may never let a timer run
    case 'progress':
    case 'recents':
    case 'followup':
      return debounceMs; // a stream of taps is folded for a couple of seconds
    default:
      return hints.mergeWindowMs; // wanted soon, but fold what arrives with it
  }
}

export interface PlanInput {
  reasons: ReadonlySet<SyncReason>;
  now: number;
  /** When the first still-unsent reason arrived (the max-wait clock). */
  firstQueuedAt: number;
  /** When the previous round started; 0 if none yet. */
  lastRoundStartedAt: number;
  hints: SyncHints;
  debounceMs?: number;
  maxWaitMs?: number;
}

/**
 * Milliseconds to wait before the next round. The most impatient reason sets the
 * wait, never past `maxWaitMs` after the first one (a steady stream still goes
 * out), and a round caused only by soft reasons keeps `minRoundGapMs` from the
 * last one.
 */
export function planSendDelay(i: PlanInput): number {
  if (i.reasons.size === 0) return i.hints.mergeWindowMs;
  let base = Infinity;
  for (const r of i.reasons) base = Math.min(base, reasonDelay(r, i.hints, i.debounceMs));
  // Same rule as nextSendDelay() in progressLogic.ts: the wait, capped by max wait.
  let delay = Math.min(base, Math.max(0, i.firstQueuedAt + (i.maxWaitMs ?? MAX_WAIT_MS) - i.now));

  const onlySoft = [...i.reasons].every((r) => SOFT.has(r));
  if (onlySoft && i.lastRoundStartedAt > 0) {
    const gapWait = Math.max(0, i.lastRoundStartedAt + i.hints.minRoundGapMs - i.now);
    delay = Math.max(delay, gapWait);
  }
  return delay;
}
