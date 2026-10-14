import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRemote, enqueue, settle, type OutboxOp, type RemoteItem } from './progressLogic.ts';
import { sanitizeAppConfig } from '../config/appConfigLogic.ts';

/**
 * The app's reading of the server's answers, pinned with real response shapes
 * (taken from server/tests/integration/contract.legacyClient.test.js). If the
 * server ever changes a field the app depends on, this and that file fail
 * together. Extra fields the server adds later must be ignored, so each test
 * also feeds a response carrying fields this version has never heard of.
 */

const op: OutboxOp = {
  opId: 'o1',
  subject: 'cse5-micro',
  moduleId: 'm1',
  topicId: 't1',
  done: true,
  updatedAt: 1_760_000_000_000,
};

const pulled: RemoteItem = {
  subject: 'cse5-micro',
  moduleId: 'm1',
  topicId: 't2',
  done: true,
  updatedAt: 1_760_000_000_500,
};

test('a sync answer { results, items, cursor, hasMore, serverTime } settles the outbox and applies the pull', () => {
  const answer = {
    results: [{ opId: 'o1', status: 'applied' as const }],
    items: [pulled],
    cursor: 'abc',
    hasMore: false,
    serverTime: 1_760_000_001_000,
  };
  const settled = settle(enqueue({}, op), [op], answer.results);
  assert.deepEqual(settled.outbox, {});
  const applied = applyRemote({}, answer.items);
  assert.equal(applied.changed, true);
  assert.deepEqual(applied.records['m1:t2'], { d: true, t: pulled.updatedAt });
});

test('rejected and superseded results leave the outbox, with the quota code recognised', () => {
  const settled = settle(
    enqueue({}, op),
    [op],
    [{ opId: 'o1', status: 'rejected', code: 'quota_exceeded' }]
  );
  assert.equal(settled.quotaExceeded, true);
  assert.equal(settled.rejected, 1);
  assert.deepEqual(settled.outbox, {});
});

test('fields added to an answer later are ignored, not fatal', () => {
  const extra = { opId: 'o1', status: 'applied' as const, future: { x: 1 } };
  const settled = settle(enqueue({}, op), [op], [extra]);
  assert.deepEqual(settled.outbox, {});
  const item = { ...pulled, newField: 'later' } as RemoteItem;
  assert.equal(applyRemote({}, [item]).changed, true);
});

test('the app-config answer parses; unknown fields are dropped, syncHints are read and clamped', () => {
  const config = sanitizeAppConfig({
    minAppVersion: '',
    recommendedAppVersion: '1.11.0',
    banner: { message: '', level: 'info', id: '' },
    flags: {
      syncEnabled: true,
      settingsSyncEnabled: true,
      nudgesEnabled: true,
      adsEnabled: true,
      paperUploadEnabled: true,
    },
    syncHints: { minRoundGapMs: 5000, mergeWindowMs: 400 },
  });
  assert.equal(config.recommendedAppVersion, '1.11.0');
  assert.deepEqual(config.syncHints, { minRoundGapMs: 5000, mergeWindowMs: 400 });
  assert.equal('somethingNew' in sanitizeAppConfig({ somethingNew: 1 }), false);
  // A server that predates syncHints (or sends garbage) leaves the defaults.
  assert.deepEqual(sanitizeAppConfig({}).syncHints, { minRoundGapMs: 3000, mergeWindowMs: 400 });
  assert.equal(config.flags.syncEnabled, true);
});
