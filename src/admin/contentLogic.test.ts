import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestQuestionId, validateQuestionFields } from './contentLogic';
import { draftAge } from './draftLogic';

const base = { questionId: 'Q1', year: '', marks: '', text: 'What is TCP?', creating: true };

test('a valid new question has no problems', () => {
  assert.equal(validateQuestionFields({ ...base, year: '2024', marks: '10' }).any, false);
});

test('creating needs an id, editing does not', () => {
  assert.ok(validateQuestionFields({ ...base, questionId: ' ' }).questionId);
  assert.equal(validateQuestionFields({ ...base, questionId: '', creating: false }).questionId, null);
});

test('year and marks are range checked, and mark the Details tab', () => {
  const p = validateQuestionFields({ ...base, year: '1800', marks: '5000' });
  assert.ok(p.year);
  assert.ok(p.marks);
  assert.equal(p.details, true);
});

test('empty text is a Text-tab problem, not a Details one', () => {
  const p = validateQuestionFields({ ...base, text: '  ' });
  assert.ok(p.text);
  assert.equal(p.details, false);
  assert.equal(p.any, true);
});

test('suggestQuestionId continues after the highest Qn', () => {
  assert.equal(suggestQuestionId([]), 'Q1');
  assert.equal(suggestQuestionId(['Q1', 'q7', 'Q3', 'extra']), 'Q8');
});

test('draftAge words', () => {
  const now = 10_000_000_000;
  assert.equal(draftAge(now - 10_000, now), 'just now');
  assert.equal(draftAge(now - 5 * 60_000, now), '5 min ago');
  assert.equal(draftAge(now - 3 * 3_600_000, now), '3 h ago');
  assert.equal(draftAge(now - 3 * 86_400_000, now), '3 d ago');
});
