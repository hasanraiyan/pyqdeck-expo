import test from 'node:test';
import assert from 'node:assert/strict';
import {
  can,
  canSend,
  configChanges,
  configToDraft,
  configWarnings,
  notifyFingerprint,
  parseEmails,
  validateConfig,
  validateNotify,
  type NotifyInput,
} from './adminLogic.ts';

test('can: grants and actions', () => {
  const tools = {
    manage_users: { actions: ['find', 'get'] },
    app_insights: { actions: '*' as const },
  };
  assert.equal(can(tools, 'manage_users', 'get'), true);
  assert.equal(can(tools, 'manage_users', 'GET'), true);
  assert.equal(can(tools, 'manage_users', 'reset_progress'), false);
  assert.equal(can(tools, 'app_insights'), true);
  assert.equal(can(tools, 'manage_app_config'), false);
  assert.equal(can(undefined, 'app_insights'), false);
});

test('parseEmails de-duplicates, lowercases and reports bad entries', () => {
  const r = parseEmails('A@x.com, b@x.com;a@X.com\nnot-an-email  c@y.in');
  assert.deepEqual(r.emails, ['a@x.com', 'b@x.com', 'c@y.in']);
  assert.deepEqual(r.invalid, ['not-an-email']);
});

const base: NotifyInput = { title: 'Hi', body: 'Hello', audience: 'all', emails: [] };

test('validateNotify limits', () => {
  assert.equal(validateNotify(base), null);
  assert.match(validateNotify({ ...base, title: ' ' })!, /title/i);
  assert.match(validateNotify({ ...base, title: 'x'.repeat(81) })!, /80/);
  assert.match(validateNotify({ ...base, body: 'x'.repeat(181) })!, /180/);
});

test('send is allowed only for exactly what was previewed', () => {
  const fp = notifyFingerprint(base);
  assert.equal(canSend(base, fp), true);
  assert.equal(canSend(base, null), false);
  assert.equal(canSend({ ...base, body: 'Changed' }, fp), false);
  assert.equal(canSend({ ...base, audience: 'beta' }, fp), false);
  assert.equal(canSend({ ...base, emails: ['a@x.com'] }, fp), false);
  // Whitespace-only edits and email order do not change who gets what.
  assert.equal(canSend({ ...base, title: ' Hi ' }, fp), true);
  const named = { ...base, emails: ['b@x.com', 'a@x.com'] };
  assert.equal(canSend({ ...named, emails: ['a@x.com', 'b@x.com'] }, notifyFingerprint(named)), true);
  // Naming people makes the audience irrelevant.
  assert.equal(
    notifyFingerprint({ ...named, audience: 'beta' }),
    notifyFingerprint({ ...named, audience: 'all' })
  );
  // An invalid form is never sendable, even if previewed.
  assert.equal(canSend({ ...base, title: '' }, notifyFingerprint({ ...base, title: '' })), false);
});

const cfg = configToDraft({
  minAppVersion: '',
  recommendedAppVersion: '',
  banner: { message: '', level: 'info', id: '' },
  flags: { syncEnabled: true, settingsSyncEnabled: true, nudgesEnabled: true },
});

test('validateConfig', () => {
  assert.equal(validateConfig(cfg), null);
  assert.match(validateConfig({ ...cfg, minAppVersion: 'soon' })!, /1\.5\.0/);
  assert.match(validateConfig({ ...cfg, bannerMessage: 'x'.repeat(201) })!, /200/);
});

test('configWarnings flags changes that block students, including this phone', () => {
  assert.deepEqual(configWarnings(cfg, cfg, '1.5.0'), []);
  const above = configWarnings(cfg, { ...cfg, minAppVersion: '1.6.0' }, '1.5.0');
  assert.equal(above.length, 1);
  assert.match(above[0], /this phone will be blocked too/);
  const below = configWarnings(cfg, { ...cfg, minAppVersion: '1.4.0' }, '1.5.0');
  assert.match(below[0], /older than 1\.4\.0/);
  assert.equal(configWarnings(cfg, { ...cfg, syncEnabled: false }, '1.5.0').length, 1);
  // Turning a switch back ON needs no warning.
  assert.deepEqual(configWarnings({ ...cfg, syncEnabled: false }, cfg, '1.5.0'), []);
  // An unchanged existing minimum is not warned about again.
  const withMin = { ...cfg, minAppVersion: '1.6.0' };
  assert.deepEqual(configWarnings(withMin, { ...withMin, bannerMessage: 'hi' }, '1.5.0'), []);
});

test('configChanges sends only what changed, and null clears a banner', () => {
  assert.deepEqual(configChanges(cfg, cfg), {});
  assert.deepEqual(configChanges(cfg, { ...cfg, minAppVersion: ' 1.6.0 ' }), {
    minAppVersion: '1.6.0',
  });
  assert.deepEqual(configChanges(cfg, { ...cfg, bannerMessage: 'Hi', bannerId: 'b1' }), {
    banner: { message: 'Hi', level: 'info', id: 'b1' },
  });
  const withBanner = { ...cfg, bannerMessage: 'Hi', bannerId: 'b1' };
  assert.deepEqual(configChanges(withBanner, { ...withBanner, bannerMessage: '' }), { banner: null });
  assert.deepEqual(configChanges(cfg, { ...cfg, nudgesEnabled: false }), {
    flags: { nudgesEnabled: false },
  });
});
