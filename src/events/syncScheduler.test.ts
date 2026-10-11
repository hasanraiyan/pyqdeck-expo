import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SYNC_HINTS } from '../config/appConfigLogic.ts';
import { SyncScheduler } from './syncScheduler.ts';

/** A fake clock + timers, so a whole burst can be replayed in microseconds. */
function harness(hints = DEFAULT_SYNC_HINTS) {
  let now = 1_000_000;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const rounds: number[] = [];
  const scheduler = new SyncScheduler({
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    hints: () => hints,
    fire: () => {
      // The owner (progressSync) starts a round here.
      scheduler.begin();
      rounds.push(now);
    },
  });
  /** Moves the clock forward, firing timers in order. */
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
    }
    now = end;
  };
  /** The round the owner started has finished. */
  const finishRound = () => scheduler.end();
  return { scheduler, advance, finishRound, rounds, timers, at: () => now };
}

test('NFR-1: a foreground, a network return and a nudge together make ONE round', () => {
  const h = harness();
  h.scheduler.add('foreground');
  h.advance(30);
  h.scheduler.add('network');
  h.advance(30);
  h.scheduler.add('nudge');
  h.advance(2000);
  assert.equal(h.rounds.length, 1);
  assert.equal(h.timers.size, 0);
});

test('NFR-2: twenty ticks in ten seconds make at most two rounds', () => {
  const h = harness();
  for (let i = 0; i < 20; i++) {
    h.scheduler.add('progress');
    h.advance(500);
    if (h.scheduler.isRunning) h.finishRound();
  }
  h.advance(5000);
  assert.ok(h.rounds.length <= 2, `rounds: ${h.rounds.length}`);
  assert.ok(h.rounds.length >= 1);
});

test('a steady stream is still sent by the max wait', () => {
  const h = harness();
  const start = h.at();
  for (let i = 0; i < 70; i++) {
    h.scheduler.add('progress'); // every second, for 70 seconds: always "just one more tick"
    h.advance(1000);
    if (h.scheduler.isRunning) h.finishRound();
  }
  assert.ok(h.rounds.length >= 2, 'a long stream must still go out regularly');
  assert.ok(h.rounds[0] - start <= 30_000 + 1000, `first round at +${h.rounds[0] - start}`);
});

test('NFR-3: with nothing happening, nothing is scheduled', () => {
  const h = harness();
  h.advance(10 * 60_000);
  assert.equal(h.rounds.length, 0);
  assert.equal(h.timers.size, 0);
});

test('an event during a round waits, then gets exactly one more round (no rerun storm)', () => {
  const h = harness();
  h.scheduler.add('progress');
  h.advance(2000);
  assert.equal(h.rounds.length, 1);
  // Mid-round: three more events. No timer may be armed while the round runs.
  h.scheduler.add('progress');
  h.scheduler.add('setting');
  h.scheduler.add('recents');
  assert.equal(h.scheduler.hasTimer, false);
  h.finishRound();
  assert.equal(h.scheduler.hasTimer, true);
  h.advance(5000);
  assert.equal(h.rounds.length, 2);
  h.finishRound();
  h.advance(60_000);
  assert.equal(h.rounds.length, 2);
});

test('lifecycle events alone keep the minimum gap from the previous round', () => {
  const h = harness();
  h.scheduler.add('progress');
  h.advance(2000);
  h.finishRound();
  const first = h.rounds[0];
  h.advance(200);
  h.scheduler.add('foreground'); // 200 ms after the round began + 2000 ms debounce, gap 3000
  h.advance(10_000);
  assert.equal(h.rounds.length, 2);
  assert.ok(h.rounds[1] - first >= DEFAULT_SYNC_HINTS.minRoundGapMs);
});

test('a server pause (429) cannot be undone by an event', () => {
  const h = harness();
  h.scheduler.holdFor(60_000);
  h.scheduler.add('setting');
  h.advance(30_000);
  assert.equal(h.rounds.length, 0, 'held');
  h.scheduler.add('foreground');
  h.advance(29_000);
  assert.equal(h.rounds.length, 0, 'still held');
  h.advance(2000);
  assert.equal(h.rounds.length, 1, 'goes out once the pause ends');
});

test('a retry timer is replaced by a newer event (back online beats the backoff)', () => {
  const h = harness();
  h.scheduler.retryIn(15 * 60_000);
  h.scheduler.add('network');
  h.advance(1000);
  assert.equal(h.rounds.length, 1);
  assert.equal(h.timers.size, 0, 'the long backoff timer is gone');
});

test('reset forgets pending reasons and timers (sign-out wipe)', () => {
  const h = harness();
  h.scheduler.add('progress');
  h.scheduler.add('setting');
  h.scheduler.reset();
  h.advance(60_000);
  assert.equal(h.rounds.length, 0);
  assert.equal(h.scheduler.pending, 0);
});

test('hints from the server change the merge window', () => {
  const h = harness({ minRoundGapMs: 1000, mergeWindowMs: 1500 });
  h.scheduler.add('setting');
  h.advance(1400);
  assert.equal(h.rounds.length, 0);
  h.advance(200);
  assert.equal(h.rounds.length, 1);
});
