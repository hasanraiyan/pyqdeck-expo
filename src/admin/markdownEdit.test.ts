import test from 'node:test';
import assert from 'node:assert/strict';
import { insertTool, joinBlocks, pruneEmptyBlocks, splitBlocks } from './markdownEdit';

const SAMPLES = [
  '',
  'one line',
  'a\n\nb',
  'a\n\n\n\nb\n',
  '\n\nstart',
  '\n\n',
  'a\n',
  '# Title\n\nPara one\nstill one\n\n- x\n- y\n\nend',
  'text\n```mermaid\ngraph TD\n\n  A-->B\n```\n\nafter',
  '$$\nE = mc^2\n\n+ 1\n$$\n\nnext $x$ inline',
  '$$x$$\n\nsingle-line math is not a container',
  '<details>\n<summary>S</summary>\n\nhidden\n\n</details>\n\nok',
  ':::step 1: A\n\nbody\n\n:::\n\n:::step 2: B\nmore\n\n## Heading after\n\ntail',
  '> [!NOTE] hi\n> there\n\n## FAQ\n\n### Q: why?\n\nbecause',
  '```js\nunclosed fence\n\nstill inside',
  'win\r\n\r\nlines\r\n',
];

test('joining the split blocks gives back the exact text', () => {
  for (const s of SAMPLES) assert.equal(joinBlocks(splitBlocks(s)), s, JSON.stringify(s));
});

test('paragraphs split on blank lines', () => {
  assert.deepEqual(
    splitBlocks('a\n\nb\nc').map((b) => b.text),
    ['a', 'b\nc']
  );
});

test('fences, display math, details and steps stay in one block even with blank lines', () => {
  assert.equal(splitBlocks('```mermaid\na\n\nb\n```').length, 1);
  assert.equal(splitBlocks('$$\na\n\nb\n$$').length, 1);
  assert.equal(splitBlocks('<details>\n<summary>S</summary>\n\nx\n\n</details>').length, 1);
  assert.equal(splitBlocks(':::step 1: A\n\nbody\n\n:::').length, 1);
});

test('single-line $$x$$ does not swallow what follows', () => {
  assert.equal(splitBlocks('$$x$$\n\nnext').length, 2);
});

test('a step ends at the next heading', () => {
  const b = splitBlocks(':::step 1: A\n\nbody\n## H\n\nafter');
  assert.deepEqual(
    b.map((x) => x.text),
    [':::step 1: A\n\nbody', '## H', 'after']
  );
});

test('pruning empty blocks keeps the rest byte-identical', () => {
  const blocks = splitBlocks('a\n\nb');
  blocks.push({ text: '', sep: '' });
  blocks[1] = { ...blocks[1], sep: '\n\n' };
  assert.equal(joinBlocks(pruneEmptyBlocks(blocks)), 'a\n\nb');
});

test('insertTool wraps a selection and starts block snippets on their own line', () => {
  assert.deepEqual(insertTool('hello', { start: 0, end: 5 }, { pre: '**', post: '**', ph: 'text' }), {
    text: '**hello**',
    caret: 7,
  });
  assert.equal(insertTool('ab', { start: 2, end: 2 }, { pre: '- ', block: true }).text, 'ab\n- ');
});

import { highlight } from './mdHighlight';

test('highlight never changes the text, whatever is typed', () => {
  const samples = [
    ...SAMPLES,
    '**bold** and *it* and ~~gone~~ and `code` and $x^2$ and [a](http://b.c)',
    '**unclosed bold',
    '* ',
    '# H1\n## H2 **b**\n> quote *q*\n- item `c`\n1. one',
    '$5 and $6 cost',
    '```\n**not bold in fence**\n```',
    '**a *b* c**',
    '<svg>\n<g/>\n</svg>',
  ];
  for (const s of samples) assert.equal(highlight(s).map((x) => x.t).join(''), s, JSON.stringify(s));
});

test('highlight marks bold text and fades its markers', () => {
  const spans = highlight('a **b** c');
  assert.deepEqual(
    spans.map((x) => [x.t, !!x.f.bold, !!x.f.dim]),
    [
      ['a ', false, false],
      ['**', false, true],
      ['b', true, false],
      ['**', false, true],
      [' c', false, false],
    ]
  );
});

test('headings are big and bold, and fences are not parsed as markdown', () => {
  assert.equal(highlight('# T')[1].f.size, 1);
  const fenced = highlight('```\n**x**\n```');
  assert.ok(fenced.every((x) => !x.f.bold));
});
