import test from 'node:test';
import assert from 'node:assert/strict';
import { toSearchQuery, isLowText, MAX_LEN } from './searchGuard.ts';

test('toSearchQuery flattens lines and collapses whitespace', () => {
  assert.equal(toSearchQuery('Define  deadlock.\n  Explain\tits   conditions'), 'Define deadlock. Explain its conditions');
});

test('toSearchQuery drops OCR junk but keeps question punctuation and maths', () => {
  assert.equal(toSearchQuery('Q1) Solve x^2 + 3x = 0 ?? ~|_ ©'), 'Q1) Solve x^2 + 3x = 0 ??');
});

test('toSearchQuery keeps non-Latin letters', () => {
  assert.equal(toSearchQuery('परिभाषा दीजिए'), 'परिभाषा दीजिए');
});

test('toSearchQuery returns empty for noise only', () => {
  assert.equal(toSearchQuery('~~ |||  \n ©©'), '');
  assert.equal(toSearchQuery(''), '');
});

test('toSearchQuery leaves short text untouched', () => {
  assert.equal(toSearchQuery('OSI model layers'), 'OSI model layers');
});

test('toSearchQuery cuts long text on a word boundary within the limit', () => {
  const long = Array.from({ length: 80 }, () => 'network').join(' ');
  const out = toSearchQuery(long);
  assert.ok(out.length <= MAX_LEN);
  assert.ok(out.endsWith('network'), 'must not end mid-word');
  assert.ok(long.startsWith(out));
});

test('toSearchQuery hard-cuts a single huge word', () => {
  const out = toSearchQuery('a'.repeat(500));
  assert.equal(out.length, MAX_LEN);
});

test('toSearchQuery honours a custom limit', () => {
  assert.equal(toSearchQuery('one two three four', 9), 'one two');
});

test('isLowText flags short or few-word scans', () => {
  assert.equal(isLowText('OSI'), true);
  assert.equal(isLowText('Define deadlock'), true);
  assert.equal(isLowText(''), true);
  assert.equal(isLowText('Explain the OSI model with a diagram'), false);
});
