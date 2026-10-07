import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStepHeader,
  parseSingleStep,
  parseStepperContainer,
  STEP_BLOCK_REGEX,
} from './stepperParser.ts';

test('parseStepHeader parses numbered headers with titles', () => {
  const h1 = parseStepHeader(':::step 1: Lexical Analysis');
  assert.equal(h1.stepNumber, '1');
  assert.equal(h1.title, 'Lexical Analysis');

  const h2 = parseStepHeader(':::step 2: Syntax Analysis (Parsing)');
  assert.equal(h2.stepNumber, '2');
  assert.equal(h2.title, 'Syntax Analysis (Parsing)');

  const h3 = parseStepHeader(':::step Phase 1: Pre-processing');
  assert.equal(h3.stepNumber, 'Phase 1');
  assert.equal(h3.title, 'Pre-processing');
});

test('parseStepHeader handles header without title or without number', () => {
  const h1 = parseStepHeader(':::step 3');
  assert.equal(h1.stepNumber, '3');
  assert.equal(h1.title, undefined);

  const h2 = parseStepHeader(':::step Client sends SYN', 1);
  assert.equal(h2.stepNumber, '1');
  assert.equal(h2.title, 'Client sends SYN');
});

test('parseSingleStep parses step block with content and ::: closing fence', () => {
  const block = `:::step 1: Lexical Analysis
Converts stream of source characters into tokens (identifiers, keywords, operators).
:::`;

  const item = parseSingleStep(block);
  assert.ok(item);
  assert.equal(item.stepNumber, '1');
  assert.equal(item.title, 'Lexical Analysis');
  assert.equal(
    item.content,
    'Converts stream of source characters into tokens (identifiers, keywords, operators).'
  );
});

test('STEP_BLOCK_REGEX stops before subsequent headings and does not swallow rest of document', () => {
  const doc = `
:::step 1: Lexical Analysis
Reads characters and builds tokens.
:::

:::step 2: Syntax Analysis
Constructs the AST.
:::

## 3. Next Section
This is normal markdown that must not be swallowed!
`;

  const matches = [...doc.matchAll(STEP_BLOCK_REGEX)];
  assert.equal(matches.length, 2);
  assert.ok(!matches[1][0].includes('Next Section'));
  assert.ok(!matches[1][0].includes('normal markdown'));
});

test('parseStepperContainer parses full :::stepper container', () => {
  const container = `:::stepper
:::step 1: SYN
Client sends SYN packet to server.
:::
:::step 2: SYN-ACK
Server responds with SYN-ACK packet.
:::
:::step 3: ACK
Client completes the 3-way handshake with ACK.
:::
:::`;

  const items = parseStepperContainer(container);
  assert.equal(items.length, 3);
  assert.equal(items[0].stepNumber, '1');
  assert.equal(items[0].title, 'SYN');
  assert.equal(items[1].stepNumber, '2');
  assert.equal(items[1].title, 'SYN-ACK');
  assert.equal(items[2].stepNumber, '3');
  assert.equal(items[2].title, 'ACK');
});
