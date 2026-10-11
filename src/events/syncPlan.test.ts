import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SYNC_HINTS, clampSyncHints } from '../config/appConfigLogic.ts';
import { planSendDelay, reasonDelay, type SyncReason } from './syncPlan.ts';

const H = DEFAULT_SYNC_HINTS;
const set = (...r: SyncReason[]) => new Set<SyncReason>(r);
const plan = (
  reasons: Set<SyncReason>,
  o: Partial<{ now: number; firstQueuedAt: number; lastRoundStartedAt: number }> = {}
) =>
  planSendDelay({
    reasons,
    now: o.now ?? 100_000,
    firstQueuedAt: o.firstQueuedAt ?? o.now ?? 100_000,
    lastRoundStartedAt: o.lastRoundStartedAt ?? 0,
    hints: H,
  });

test('ticks wait the debounce; wake-up events wait only the merge window; leaving the app waits nothing', () => {
  assert.equal(reasonDelay('progress', H), 2000);
  assert.equal(reasonDelay('recents', H), 2000);
  assert.equal(reasonDelay('foreground', H), 400);
  assert.equal(reasonDelay('setting', H), 400);
  assert.equal(reasonDelay('background', H), 0);
});

test('events arriving together are served by one wait: the most impatient reason sets it', () => {
  assert.equal(plan(set('progress')), 2000);
  assert.equal(plan(set('progress', 'foreground')), 400);
  assert.equal(plan(set('foreground', 'network', 'nudge')), 400);
  assert.equal(plan(set('progress', 'background')), 0);
});

test('a steady stream is never held past the max wait', () => {
  const first = 100_000;
  assert.equal(plan(set('progress'), { now: first + 29_000, firstQueuedAt: first }), 1000);
  assert.equal(plan(set('progress'), { now: first + 31_000, firstQueuedAt: first }), 0);
});

test('lifecycle events alone keep the minimum gap from the previous round', () => {
  const now = 100_000;
  assert.equal(plan(set('foreground'), { now, lastRoundStartedAt: now - 1000 }), 2000);
  assert.equal(plan(set('foreground', 'network'), { now, lastRoundStartedAt: now - 5000 }), 400);
  assert.equal(plan(set('nudge'), { now, lastRoundStartedAt: now - 100 }), 2900);
});

test('the gap never delays a tick, a setting change, sign-in or leaving the app', () => {
  const now = 100_000;
  const recent = { now, lastRoundStartedAt: now - 100 };
  assert.equal(plan(set('progress'), recent), 2000);
  assert.equal(plan(set('setting'), recent), 400);
  assert.equal(plan(set('auth'), recent), 400);
  assert.equal(plan(set('background'), recent), 0);
  assert.equal(plan(set('foreground', 'setting'), recent), 400);
});

test('the first round of a session has no gap to keep', () => {
  assert.equal(plan(set('foreground'), { lastRoundStartedAt: 0 }), 400);
});

test('hints from the server are clamped to the same bounds the server enforces', () => {
  assert.deepEqual(clampSyncHints({ minRoundGapMs: 5, mergeWindowMs: 99999 }), {
    minRoundGapMs: 1000,
    mergeWindowMs: 2000,
  });
  assert.deepEqual(clampSyncHints({ minRoundGapMs: 999_999, mergeWindowMs: 50 }), {
    minRoundGapMs: 300_000,
    mergeWindowMs: 100,
  });
  assert.deepEqual(clampSyncHints({ minRoundGapMs: 5000.4, mergeWindowMs: 250 }), {
    minRoundGapMs: 5000,
    mergeWindowMs: 250,
  });
});

test('missing or garbage hints fall back to the defaults', () => {
  for (const raw of [undefined, null, 'x', 7, [], { minRoundGapMs: 'a', mergeWindowMs: NaN }]) {
    assert.deepEqual(clampSyncHints(raw), H);
  }
});

test('request budget: a foreground + network + nudge burst plans exactly one round', () => {
  // The coordinator holds ONE timer for the reason set, so three events inside
  // the window produce one send time, not three.
  const reasons = set();
  const times: number[] = [];
  const t0 = 100_000;
  for (const [offset, r] of [
    [0, 'foreground'],
    [30, 'network'],
    [60, 'nudge'],
  ] as [number, SyncReason][]) {
    reasons.add(r);
    times.push(t0 + offset + plan(reasons, { now: t0 + offset, firstQueuedAt: t0 }));
  }
  // Each event pushes the send back by at most its own window; the last decides.
  assert.equal(times[times.length - 1], t0 + 60 + 400);
});
