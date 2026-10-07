import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCodeTabs, getLanguageLabel } from './codeTabParser.ts';

test('getLanguageLabel resolves known languages properly', () => {
  assert.equal(getLanguageLabel('java'), 'Java');
  assert.equal(getLanguageLabel('py'), 'Python');
  assert.equal(getLanguageLabel('python'), 'Python');
  assert.equal(getLanguageLabel('cpp'), 'C++');
  assert.equal(getLanguageLabel('js'), 'JavaScript');
  assert.equal(getLanguageLabel('ts'), 'TypeScript');
  assert.equal(getLanguageLabel('rust'), 'Rust');
  assert.equal(getLanguageLabel('sql'), 'SQL');
  assert.equal(getLanguageLabel('unknownlang'), 'Unknownlang');
});

test('groupCodeTabs groups consecutive multi-language code blocks into code_tabs', () => {
  const blocks = [
    { type: 'markdown', content: 'Intro text' },
    { type: 'code', language: 'java', code: 'class Solution { int sum() { return 1; } }' },
    { type: 'code', language: 'python', code: 'def sum(): return 1' },
    { type: 'code', language: 'cpp', code: 'int sum() { return 1; }' },
    { type: 'markdown', content: 'Outro text' },
  ];

  const grouped = groupCodeTabs(blocks);
  assert.equal(grouped.length, 3);
  assert.equal(grouped[0].type, 'markdown');
  assert.equal(grouped[1].type, 'code_tabs');

  const tabsBlock = grouped[1] as any;
  assert.equal(tabsBlock.tabs.length, 3);
  assert.equal(tabsBlock.tabs[0].label, 'Java');
  assert.equal(tabsBlock.tabs[1].label, 'Python');
  assert.equal(tabsBlock.tabs[2].label, 'C++');
  assert.equal(grouped[2].type, 'markdown');
});

test('groupCodeTabs groups headed approach blocks into code_tabs with custom titles', () => {
  const blocks = [
    { type: 'markdown', content: '### Approach 1: Iterative' },
    { type: 'code', language: 'python', code: 'def binary_search(arr, x): pass' },
    { type: 'markdown', content: '### Approach 2: Recursive' },
    { type: 'code', language: 'python', code: 'def binary_search_rec(arr, low, high, x): pass' },
  ];

  const grouped = groupCodeTabs(blocks);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].type, 'code_tabs');

  const tabsBlock = grouped[0] as any;
  assert.equal(tabsBlock.tabs.length, 2);
  assert.equal(tabsBlock.tabs[0].label, 'Approach 1: Iterative');
  assert.equal(tabsBlock.tabs[1].label, 'Approach 2: Recursive');
});

test('groupCodeTabs preserves single isolated code blocks', () => {
  const blocks = [
    { type: 'markdown', content: 'Heading' },
    { type: 'code', language: 'python', code: 'single_code()' },
    { type: 'markdown', content: 'Explanation' },
  ];

  const grouped = groupCodeTabs(blocks);
  assert.equal(grouped.length, 3);
  assert.equal(grouped[1].type, 'code');
});
