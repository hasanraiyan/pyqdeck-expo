import test from 'node:test';
import assert from 'node:assert/strict';
import { queryTerms, splitHighlight } from './highlight.ts';

const hits = (text: string, q: string) => splitHighlight(text, q).filter((p) => p.hit).map((p) => p.text);

test('queryTerms drops stopwords and 1-char tokens, dedupes, ignores case', () => {
  assert.deepEqual(queryTerms('Explain the OSI model of a Model').sort(), ['model', 'osi']);
});

test('queryTerms is safe with regex characters', () => {
  assert.deepEqual(queryTerms('c++ (a|b) [x]'), []);
  assert.doesNotThrow(() => splitHighlight('x^2 (y) [z]', '.* ( [ \\\\ ^$|?+'));
});

test('highlights whole words, case-insensitively', () => {
  assert.deepEqual(hits('The OSI Model has seven layers', 'osi model'), ['OSI', 'Model']);
});

test('matches word prefixes so plurals light up', () => {
  assert.deepEqual(hits('Computer networks and protocols', 'network'), ['networks']);
});

test('does not highlight mid-word substrings', () => {
  assert.deepEqual(hits('A string of data', 'ring'), []);
});

test('keeps all the text intact and in order', () => {
  const text = 'Define deadlock, then explain its conditions.';
  const out = splitHighlight(text, 'deadlock conditions').map((p) => p.text).join('');
  assert.equal(out, text);
});

test('empty query or empty text', () => {
  assert.deepEqual(splitHighlight('hello world', ''), [{ text: 'hello world', hit: false }]);
  assert.deepEqual(splitHighlight('', 'hello'), []);
});

test('works with Devanagari combining marks', () => {
  assert.deepEqual(hits('परिभाषा दीजिए', 'परिभाषा'), ['परिभाषा']);
});
