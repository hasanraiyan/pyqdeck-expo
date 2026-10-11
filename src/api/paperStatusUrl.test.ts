import test from 'node:test';
import assert from 'node:assert/strict';
import { paperStatusPath } from './paperStatusUrl.ts';

test('plain path is cacheable and unchanged for students', () => {
  assert.equal(paperStatusPath('sem6_computer_networks', 2025), '/papers/sem6_computer_networks/2025');
});

test('a bust value makes the URL unique so caches are skipped', () => {
  assert.equal(
    paperStatusPath('sem6_computer_networks', 2025, 1700000000000),
    '/papers/sem6_computer_networks/2025?fresh=1700000000000'
  );
  assert.notEqual(paperStatusPath('s', 2025, 1), paperStatusPath('s', 2025, 2));
});

test('subject ids are URL-encoded', () => {
  assert.equal(paperStatusPath('a b/c', 2024), '/papers/a%20b%2Fc/2024');
});

test('no bust (0 or undefined) means the plain path', () => {
  assert.equal(paperStatusPath('s', 2024, 0), '/papers/s/2024');
  assert.equal(paperStatusPath('s', 2024, undefined), '/papers/s/2024');
});
