import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRemote,
  backoffMs,
  batches,
  canSync,
  countDone,
  enqueue,
  planFirstPush,
  remoteWins,
  settle,
  splitTopicKey,
  topicKey,
  type OutboxOp,
} from './progressLogic.ts';
import { categoryOf, planWipe, STORAGE_REGISTRY, WIPE_PENDING_KEY } from './storageRegistry.ts';

const op = (over: Partial<OutboxOp> = {}): OutboxOp => ({
  opId: 'o1',
  subject: 's',
  moduleId: 'm',
  topicId: 't',
  done: true,
  updatedAt: 100,
  ...over,
});
const remote = (over = {}) => ({
  subject: 's',
  moduleId: 'm',
  topicId: 't',
  done: true,
  updatedAt: 100,
  ...over,
});

test('topic keys round trip', () => {
  assert.equal(topicKey('m1', 't1'), 'm1:t1');
  assert.deepEqual(splitTopicKey('m1:t1'), { moduleId: 'm1', topicId: 't1' });
  assert.equal(splitTopicKey('nope'), null);
});

test('remoteWins: newer wins, ties go to done, migrated v1 loses to anything', () => {
  assert.equal(remoteWins(undefined, remote()), true);
  assert.equal(remoteWins({ d: true, t: 50 }, remote({ updatedAt: 60, done: false })), true);
  assert.equal(remoteWins({ d: true, t: 70 }, remote({ updatedAt: 60, done: false })), false);
  assert.equal(remoteWins({ d: false, t: 60 }, remote({ updatedAt: 60, done: true })), true);
  assert.equal(remoteWins({ d: true, t: 60 }, remote({ updatedAt: 60, done: false })), false);
  assert.equal(remoteWins({ d: true, t: 0 }, remote({ updatedAt: 0, done: false })), true);
});

test('applyRemote merges and skips topics with a queued local change', () => {
  const local = { 'm:t': { d: true, t: 10 }, 'm:u': { d: false, t: 10 } };
  const res = applyRemote(
    local,
    [remote({ topicId: 't', done: false, updatedAt: 20 }), remote({ topicId: 'u', updatedAt: 30 })],
    new Set(['m:u'])
  );
  assert.deepEqual(res.records['m:t'], { d: false, t: 20 });
  assert.deepEqual(res.records['m:u'], { d: false, t: 10 });
  assert.equal(res.changed, true);
  assert.equal(applyRemote(res.records, [remote({ topicId: 't', done: false, updatedAt: 20 })]).changed, false);
});

test('enqueue coalesces per topic, last change wins', () => {
  let box = enqueue({}, op({ opId: 'a', done: true }));
  box = enqueue(box, op({ opId: 'b', done: false, updatedAt: 200 }));
  box = enqueue(box, op({ opId: 'c', topicId: 'other' }));
  assert.equal(Object.keys(box).length, 2);
  assert.equal(box['s|m:t'].opId, 'b');
});

test('batches splits by size', () => {
  assert.deepEqual(batches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(batches([], 2), []);
});

test('settle removes answered ops but keeps a newer change to the same topic', () => {
  const sent = [op({ opId: 'a' }), op({ opId: 'x', topicId: 'u' })];
  let box = enqueue({}, sent[0]);
  box = enqueue(box, sent[1]);
  box = enqueue(box, op({ opId: 'newer', done: false, updatedAt: 300 })); // replaces 'a'
  const res = settle(box, sent, [
    { opId: 'a', status: 'applied' },
    { opId: 'x', status: 'rejected', code: 'quota_exceeded' },
  ]);
  assert.deepEqual(Object.values(res.outbox).map((o) => o.opId), ['newer']);
  assert.equal(res.quotaExceeded, true);
  assert.equal(res.rejected, 1);
});

test('settle keeps ops the server did not answer for', () => {
  const sent = [op({ opId: 'a' })];
  const box = enqueue({}, sent[0]);
  assert.equal(Object.keys(settle(box, sent, []).outbox).length, 1);
});

test('planFirstPush: local-only and locally-newer are pushed, v1 ticks only if server lacks them', () => {
  let n = 0;
  const id = () => `id${n++}`;
  const local = {
    s: {
      'm:only': { d: true, t: 5 },
      'm:v1': { d: true, t: 0 },
      'm:v1both': { d: true, t: 0 },
      'm:newer': { d: false, t: 90 },
      'm:older': { d: true, t: 10 },
      'm:untick': { d: false, t: 5 },
    },
  };
  const ops = planFirstPush(
    local,
    [
      remote({ topicId: 'v1both', updatedAt: 40 }),
      remote({ topicId: 'newer', updatedAt: 50 }),
      remote({ topicId: 'older', updatedAt: 60 }),
    ],
    id
  );
  assert.deepEqual(ops.map((o) => o.topicId).sort(), ['newer', 'only', 'v1']);
});

test('backoff doubles from 5s and caps at 15 min', () => {
  assert.equal(backoffMs(0), 5_000);
  assert.equal(backoffMs(1), 10_000);
  assert.equal(backoffMs(30), 15 * 60_000);
});

test('canSync needs every condition', () => {
  const all = { signedIn: true, authEnabled: true, syncEnabled: true, online: true };
  assert.equal(canSync(all), true);
  for (const k of Object.keys(all) as (keyof typeof all)[]) {
    assert.equal(canSync({ ...all, [k]: false }), false);
  }
});

test('countDone ignores keys not in the loaded syllabus', () => {
  const recs = { 'm:a': { d: true, t: 1 }, 'm:b': { d: false, t: 1 }, 'm:gone': { d: true, t: 1 } };
  assert.equal(countDone(recs), 2);
  assert.equal(countDone(recs, new Set(['m:a', 'm:b'])), 1);
  assert.equal(countDone(undefined), 0);
});

test('wipe plan removes user data, cache and unregistered keys; keeps device keys', () => {
  const keys = [
    'pyqdeck:progress:cse5',
    'syllabus_done_cse5',
    'pyqdeck:recent_study',
    'pyqdeck:vote:s:q1',
    'pyq_recent_searches',
    'pyq_rq_cache',
    'selected_syllabus_branch',
    'pyqdeck:owner',
    'volume_scroll_enabled',
    'pyqdeck:onboarded',
    'pyq_cache_migrated_rq',
    'interstitial_opens_since_last_shown',
    'some_new_unregistered_key',
    WIPE_PENDING_KEY,
  ];
  const plan = planWipe(keys);
  assert.deepEqual(plan.unregistered, ['some_new_unregistered_key']);
  assert.ok(plan.remove.includes('pyq_rq_cache'));
  assert.ok(plan.remove.includes('some_new_unregistered_key'));
  for (const kept of [
    'volume_scroll_enabled',
    'pyqdeck:onboarded',
    'pyq_cache_migrated_rq',
    'interstitial_opens_since_last_shown',
    WIPE_PENDING_KEY,
  ]) {
    assert.ok(!plan.remove.includes(kept), kept);
  }
});

test('registry categories', () => {
  assert.equal(categoryOf('pyq_cache_migrated_rq'), 'device');
  assert.equal(categoryOf('pyq_whatever'), 'cache');
  assert.equal(categoryOf('pyqdeck:vote:a:b'), 'user');
  assert.equal(categoryOf('unknown'), null);
  assert.ok(STORAGE_REGISTRY.length > 20);
});
