import test from 'node:test';
import assert from 'node:assert/strict';
import { emit, on, once, resetBus, setEventErrorReporter } from './bus.ts';

const tick = () => new Promise<void>((r) => setImmediate(r));

test('handlers run after the emitter continues, in registration order', async () => {
  resetBus();
  const seen: string[] = [];
  on('progress.changed', () => void seen.push('a'));
  on('progress.changed', () => void seen.push('b'));
  emit('progress.changed', { subjectId: 's1' });
  seen.push('after-emit');
  await tick();
  assert.deepEqual(seen, ['after-emit', 'a', 'b']);
});

test('the payload reaches every handler', async () => {
  resetBus();
  const got: string[] = [];
  on('progress.changed', (p) => void got.push(p.subjectId));
  on('progress.changed', (p) => void got.push(p.subjectId + '!'));
  emit('progress.changed', { subjectId: 'x' });
  await tick();
  assert.deepEqual(got, ['x', 'x!']);
});

test('a throwing handler is reported and does not stop the others', async () => {
  resetBus();
  const errors: unknown[] = [];
  setEventErrorReporter((e) => void errors.push(e));
  let ran = false;
  on('app.foreground', () => {
    throw new Error('boom');
  });
  on('app.foreground', () => {
    ran = true;
  });
  emit('app.foreground');
  await tick();
  assert.equal(ran, true);
  assert.equal(errors.length, 1);
});

test('a rejecting async handler is reported, not unhandled', async () => {
  resetBus();
  const errors: unknown[] = [];
  setEventErrorReporter((e) => void errors.push(e));
  on('app.background', async () => {
    throw new Error('async boom');
  });
  emit('app.background');
  await tick();
  assert.equal(errors.length, 1);
});

test('unsubscribe stops delivery; once fires a single time', async () => {
  resetBus();
  let a = 0;
  let b = 0;
  const off = on('network.online', () => void a++);
  once('network.online', () => void b++);
  emit('network.online');
  await tick();
  off();
  emit('network.online');
  await tick();
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test('a handler that unsubscribes mid-delivery does not skip the next one', async () => {
  resetBus();
  const seen: string[] = [];
  const off = on('app.foreground', () => {
    seen.push('first');
    off();
  });
  on('app.foreground', () => void seen.push('second'));
  emit('app.foreground');
  await tick();
  assert.deepEqual(seen, ['first', 'second']);
});

test('an event with no listener is harmless', async () => {
  resetBus();
  emit('config.changed');
  await tick();
});
