import type { SyncHints } from '../config/appConfigLogic';
import { planSendDelay, type SyncReason } from './syncPlan';

/**
 * The timer half of the sync coordinator (docs/SRS-event-driven-architecture.md,
 * SYN-FR-2..4). It owns the ONE pending timer and the set of reasons waiting for
 * the next round, with the clock and timers injected so the request-budget rules
 * can be tested with a fake clock (no React Native, no storage).
 *
 * Life of a round:
 *   add(reason) ... add(reason)   -> one timer, re-armed from the whole set
 *   timer fires -> fire()         -> the owner calls begin(), then runs the round
 *   add(reason) while running     -> waits in the set, no timer
 *   end()                         -> arms one timer for whatever waited
 */

export interface SchedulerDeps {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  hints(): SyncHints;
  /** Called when the timer fires; the owner starts a round. */
  fire(): void;
}

export class SyncScheduler {
  private reasons = new Set<SyncReason>();
  private firstQueuedAt = 0;
  private lastRoundStartedAt = 0;
  private holdUntil = 0;
  private timer: unknown = null;
  private running = false;

  private readonly deps: SchedulerDeps;

  constructor(deps: SchedulerDeps) {
    this.deps = deps;
  }

  /** A reason wants a round. Reasons arriving close together share one. */
  add(reason: SyncReason, debounceMs?: number): void {
    if (this.reasons.size === 0) this.firstQueuedAt = this.deps.now();
    this.reasons.add(reason);
    if (this.running) return; // the finishing round arms the next one
    this.arm(debounceMs);
  }

  private arm(debounceMs?: number): void {
    this.cancel();
    const now = this.deps.now();
    const planned = planSendDelay({
      reasons: this.reasons,
      now,
      firstQueuedAt: this.firstQueuedAt,
      lastRoundStartedAt: this.lastRoundStartedAt,
      hints: this.deps.hints(),
      debounceMs,
    });
    const delay = Math.max(planned, this.holdUntil - now);
    this.timer = this.deps.setTimeout(() => {
      this.timer = null;
      this.deps.fire();
    }, delay);
  }

  /** A retry after a failure: replaces the pending timer, ignores the reason set. */
  retryIn(ms: number): void {
    this.cancel();
    this.timer = this.deps.setTimeout(() => {
      this.timer = null;
      this.deps.fire();
    }, ms);
  }

  /** The server said when to come back: no event may bring the next round sooner. */
  holdFor(ms: number): void {
    this.holdUntil = this.deps.now() + ms;
  }

  /** A round is starting: it serves everything waiting, and anything new waits for the next. */
  begin(): void {
    this.running = true;
    this.reasons.clear();
    this.lastRoundStartedAt = this.deps.now();
  }

  /** The round got as far as talking to the server: it counts for the minimum gap. */
  roundStarted(): void {
    this.lastRoundStartedAt = this.deps.now();
  }

  /** `begin()` without counting the round for the minimum gap (it did not really run). */
  beginWithoutRound(): void {
    this.running = true;
    this.reasons.clear();
  }

  /** The round is over; reasons that arrived meanwhile get their one timer. */
  end(): void {
    this.running = false;
    if (this.reasons.size > 0) this.arm();
  }

  cancel(): void {
    if (this.timer !== null) this.deps.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Forget everything (sign-out, wipe). */
  reset(): void {
    this.cancel();
    this.reasons.clear();
    this.holdUntil = 0;
    this.lastRoundStartedAt = 0;
  }

  /** Forget only what is waiting (sign-out keeps the gap clocks). */
  clearPending(): void {
    this.cancel();
    this.reasons.clear();
    this.holdUntil = 0;
  }

  get hasTimer(): boolean {
    return this.timer !== null;
  }

  get pending(): number {
    return this.reasons.size;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
