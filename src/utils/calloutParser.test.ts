import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalloutBlock, CALLOUT_BLOCK_REGEX } from './calloutParser.ts';

test('parseCalloutBlock parses [!TIP] with multi-line content', () => {
  const raw = `> [!TIP]
> Always declare JVM local variables inside the method for thread safety.
> This ensures thread safety without synchronization overhead.`;

  const parsed = parseCalloutBlock(raw);
  assert.ok(parsed);
  assert.equal(parsed.type, 'tip');
  assert.equal(parsed.title, 'Pro Tip');
  assert.equal(
    parsed.content,
    'Always declare JVM local variables inside the method for thread safety.\nThis ensures thread safety without synchronization overhead.'
  );
});

test('parseCalloutBlock parses [!WARNING] with custom header title', () => {
  const raw = `> [!WARNING] Common exam trap
> Do not confuse Interface inheritance with Class extension!`;

  const parsed = parseCalloutBlock(raw);
  assert.ok(parsed);
  assert.equal(parsed.type, 'exam');
  assert.equal(parsed.title, 'Common exam trap');
  assert.equal(
    parsed.content,
    'Do not confuse Interface inheritance with Class extension!'
  );
});

test('parseCalloutBlock parses single line callout', () => {
  const raw = '> [!NOTE] Bytecode verifier ensures memory safety.';

  const parsed = parseCalloutBlock(raw);
  assert.ok(parsed);
  assert.equal(parsed.type, 'note');
  assert.equal(parsed.title, 'Note');
  assert.equal(parsed.content, 'Bytecode verifier ensures memory safety.');
});

test('parseCalloutBlock parses [!CAUTION] and [!IMPORTANT]', () => {
  const caution = parseCalloutBlock('> [!CAUTION]\n> Danger of stack overflow on deep recursion');
  assert.ok(caution);
  assert.equal(caution.type, 'caution');
  assert.equal(caution.title, 'Caution');

  const important = parseCalloutBlock('> [!IMPORTANT]\n> Required for semester exam questions');
  assert.ok(important);
  assert.equal(important.type, 'important');
  assert.equal(important.title, 'Important');
});

test('CALLOUT_BLOCK_REGEX matches all callout blocks in document', () => {
  const doc = `# Title

> [!NOTE]
> Note 1

Paragraph.

> [!TIP] Title 2
> Tip line 1
> Tip line 2

End.`;

  const matches = [...doc.matchAll(CALLOUT_BLOCK_REGEX)];
  assert.equal(matches.length, 2);
  assert.equal(matches[0][1], 'NOTE');
  assert.equal(matches[1][1], 'TIP');
});
