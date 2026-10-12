import test from 'node:test';
import assert from 'node:assert/strict';
import { ChangeBatcher } from './changeBatcher.ts';

function harness() {
  const timers: (() => void)[] = [];
  const out: (string[] | null)[] = [];
  const b = new ChangeBatcher({
    setTimeout: (fn) => void timers.push(fn),
    flush: (ids) => void out.push(ids),
  });
  const runTimers = () => timers.splice(0).forEach((fn) => fn());
  return { b, out, runTimers, timers };
}

test('a burst of notices is one flush carrying every subject, each once', () => {
  const h = harness();
  h.b.note(['a']);
  h.b.note(['b']);
  h.b.note(['a', 'c']);
  assert.equal(h.timers.length, 1, 'one timer for the whole burst');
  h.runTimers();
  assert.deepEqual(h.out, [['a', 'b', 'c']]);
});

test('"cannot say which" wins over a list in the same burst', () => {
  const h = harness();
  h.b.note(['a']);
  h.b.note();
  h.b.note(['b']);
  h.runTimers();
  assert.deepEqual(h.out, [null]);
});

test('the next burst starts clean', () => {
  const h = harness();
  h.b.note(['a']);
  h.runTimers();
  h.b.note(['b']);
  h.runTimers();
  assert.deepEqual(h.out, [['a'], ['b']]);
  h.b.note();
  h.runTimers();
  h.b.note(['c']);
  h.runTimers();
  assert.deepEqual(h.out, [['a'], ['b'], null, ['c']]);
});

test('nothing noted, nothing flushed', () => {
  const h = harness();
  h.runTimers();
  assert.deepEqual(h.out, []);
});
