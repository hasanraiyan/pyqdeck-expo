import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APP_CONFIG,
  isVersionBelow,
  parseVersion,
  sanitizeAppConfig,
  updateStatus,
} from './appConfigLogic.ts';

test('parseVersion accepts plain x.y.z only', () => {
  assert.deepEqual(parseVersion('1.5.0'), [1, 5, 0]);
  assert.deepEqual(parseVersion(' 10.0.12 '), [10, 0, 12]);
  for (const bad of ['1.5', '1.5.0-beta', 'v1.5.0', '', null, 5, undefined]) {
    assert.equal(parseVersion(bad), null, String(bad));
  }
});

test('isVersionBelow compares numerically, not as text', () => {
  assert.equal(isVersionBelow('1.4.0', '1.5.0'), true);
  assert.equal(isVersionBelow('1.5.0', '1.5.0'), false);
  assert.equal(isVersionBelow('1.5.1', '1.5.0'), false);
  assert.equal(isVersionBelow('1.9.0', '1.10.0'), true); // text order would say false
  assert.equal(isVersionBelow('2.0.0', '1.99.99'), false);
});

test('a missing or unparseable requirement never blocks anyone', () => {
  assert.equal(isVersionBelow('1.0.0', ''), false);
  assert.equal(isVersionBelow('1.0.0', 'garbage'), false);
  assert.equal(isVersionBelow('dev', '1.5.0'), false); // unknown running version: do not lock out
});

test('sanitizeAppConfig falls back to defaults on any garbage', () => {
  for (const raw of [null, undefined, 'x', 42, [], { flags: 'nope', banner: 7 }]) {
    assert.deepEqual(sanitizeAppConfig(raw), DEFAULT_APP_CONFIG);
  }
  const c = sanitizeAppConfig({
    minAppVersion: 'latest',
    recommendedAppVersion: '1.6.0',
    banner: { message: '  Hello  ', level: 'critical', id: 'b1' },
    flags: { syncEnabled: false, nudgesEnabled: 'no' },
  });
  assert.equal(c.minAppVersion, '');
  assert.equal(c.recommendedAppVersion, '1.6.0');
  assert.deepEqual(c.banner, { message: 'Hello', level: 'info', id: 'b1' });
  assert.equal(c.flags.syncEnabled, false);
  assert.equal(c.flags.nudgesEnabled, true); // wrong type: default, not "off"
  assert.equal(c.flags.settingsSyncEnabled, true);
});

test('a very long banner is cut to 200 characters', () => {
  const c = sanitizeAppConfig({ banner: { message: 'x'.repeat(500) } });
  assert.equal(c.banner.message.length, 200);
});

test('updateStatus', () => {
  const cfg = sanitizeAppConfig({ minAppVersion: '1.5.0', recommendedAppVersion: '1.6.0' });
  assert.equal(updateStatus(cfg, '1.4.0'), 'required');
  assert.equal(updateStatus(cfg, '1.5.0'), 'recommended');
  assert.equal(updateStatus(cfg, '1.6.0'), 'ok');
  assert.equal(updateStatus(DEFAULT_APP_CONFIG, '0.0.1'), 'ok');
});
