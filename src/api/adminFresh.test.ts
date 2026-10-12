import test from 'node:test';
import assert from 'node:assert/strict';
import { markAdminWrite, setAdminFreshReads, withFresh } from './adminFresh';

test('students get the cached path untouched', () => {
  setAdminFreshReads(false);
  assert.equal(withFresh('/semesters'), '/semesters');
});

test('admins get a unique fresh param, appended correctly', () => {
  setAdminFreshReads(true);
  assert.match(withFresh('/semesters'), /^\/semesters\?fresh=\d+$/);
  assert.match(withFresh('/subjects/x/questions?limit=50'), /\?limit=50&fresh=\d+$/);
  setAdminFreshReads(false);
});

test('an existing fresh param is left alone', () => {
  setAdminFreshReads(true);
  assert.equal(withFresh('/papers/a/2020?fresh=5'), '/papers/a/2020?fresh=5');
  setAdminFreshReads(false);
});

test('a recent write busts reads even before the admin check resolves', () => {
  setAdminFreshReads(false);
  markAdminWrite();
  assert.match(withFresh('/semesters'), /fresh=\d+/);
});
