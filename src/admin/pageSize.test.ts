import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLongEdge, MAX_PAGE_EDGE } from './pageSize.ts';

test('leaves images that already fit alone', () => {
  assert.equal(fitLongEdge(2000, 1500), null);
  assert.equal(fitLongEdge(MAX_PAGE_EDGE, 100), null);
});

test('scales a big landscape photo by width', () => {
  assert.deepEqual(fitLongEdge(8160, 6120), { width: MAX_PAGE_EDGE });
});

test('scales a big portrait photo by height', () => {
  assert.deepEqual(fitLongEdge(6120, 8160), { height: MAX_PAGE_EDGE });
});

test('a square counts as landscape', () => {
  assert.deepEqual(fitLongEdge(5000, 5000), { width: MAX_PAGE_EDGE });
});

test('ignores unknown or invalid sizes', () => {
  assert.equal(fitLongEdge(0, 5000), null);
  assert.equal(fitLongEdge(NaN, 5000), null);
});

test('honours a custom limit', () => {
  assert.deepEqual(fitLongEdge(1000, 400, 500), { width: 500 });
});
