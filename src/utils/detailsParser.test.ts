import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDetailsBlock, DETAILS_REGEX } from './detailsParser.ts';

test('parses basic <details><summary> block', () => {
  const input = `<details>
<summary>💡 Hint: Matrix Exponentiation</summary>
Recall that Fibonacci can be framed as a 2x2 state transition matrix.
</details>`;

  const data = parseDetailsBlock(input);
  assert.ok(data);
  assert.equal(data.summary, '💡 Hint: Matrix Exponentiation');
  assert.equal(data.content, 'Recall that Fibonacci can be framed as a 2x2 state transition matrix.');
  assert.equal(data.defaultOpen, false);
});

test('parses <details open> with defaultOpen=true', () => {
  const input = `<details open>
<summary>Solution Steps</summary>
Step 1: Check constraints.
</details>`;

  const data = parseDetailsBlock(input);
  assert.ok(data);
  assert.equal(data.summary, 'Solution Steps');
  assert.equal(data.content, 'Step 1: Check constraints.');
  assert.equal(data.defaultOpen, true);
});

test('returns null for non-details text', () => {
  assert.equal(parseDetailsBlock('Just regular text'), null);
  assert.equal(parseDetailsBlock('<summary>without details</summary>'), null);
});

test('DETAILS_REGEX matches multiple details blocks', () => {
  const doc = `
# Topic
<details><summary>Hint 1</summary>First hint</details>
Some text in between
<details><summary>Hint 2</summary>Second hint</details>
`;

  const matches = [...doc.matchAll(DETAILS_REGEX)];
  assert.equal(matches.length, 2);
  assert.ok(matches[0][0].includes('Hint 1'));
  assert.ok(matches[1][0].includes('Hint 2'));
});
