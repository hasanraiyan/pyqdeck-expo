import test from 'node:test';
import assert from 'node:assert/strict';
import { overallProgress, cloudinaryErrorMessage } from './directUpload.ts';

test('overallProgress spreads the bar across pages', () => {
  assert.equal(overallProgress(0, 4, 0), 0);
  assert.equal(overallProgress(0, 4, 0.5), 0.125);
  assert.equal(overallProgress(1, 4, 0), 0.25);
  assert.equal(overallProgress(3, 4, 1), 1);
});

test('overallProgress clamps and tolerates bad input', () => {
  assert.equal(overallProgress(0, 2, 5), 0.5);
  assert.equal(overallProgress(0, 2, -1), 0);
  assert.equal(overallProgress(0, 2, NaN), 0);
  assert.equal(overallProgress(9, 2, 1), 1);
  assert.equal(overallProgress(0, 0, 0.5), 0);
});

test('cloudinaryErrorMessage prefers the host\'s own message', () => {
  assert.equal(
    cloudinaryErrorMessage({ error: { message: 'Invalid Signature abc. String to sign - x' } }, 401),
    'Invalid Signature abc. String to sign - x'
  );
});

test('cloudinaryErrorMessage falls back to the status', () => {
  assert.equal(cloudinaryErrorMessage(null, 413), 'upload rejected (HTTP 413)');
  assert.equal(cloudinaryErrorMessage({}, 500), 'upload rejected (HTTP 500)');
  assert.equal(cloudinaryErrorMessage({ error: { message: '   ' } }, 400), 'upload rejected (HTTP 400)');
  assert.equal(cloudinaryErrorMessage(undefined, 0), 'upload rejected (HTTP no response)');
});
