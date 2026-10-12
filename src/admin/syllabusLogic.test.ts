import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canReadSyllabus,
  canWriteNotes,
  canWriteSyllabus,
  deleteConfirmText,
  parseTopicTitles,
  pickNotesWrite,
  suggestSlug,
  validateModuleTitle,
  validateSubjectDraft,
  validateTopicTitle,
  writableBranches,
} from './syllabusLogic.ts';

test('gating follows manage_syllabus / manage_notes grants', () => {
  assert.equal(canReadSyllabus({ manage_syllabus: { actions: ['read'] } }), true);
  assert.equal(canReadSyllabus({ manage_notes: { actions: ['read'] } }), true);
  assert.equal(canReadSyllabus({ manage_users: { actions: ['find'] } }), false);
  assert.equal(canReadSyllabus(undefined), false);
  assert.equal(canWriteSyllabus({ manage_syllabus: { actions: ['update'] } }, 'update'), true);
  assert.equal(canWriteSyllabus({ manage_syllabus: { actions: ['read'] } }, 'update'), false);
  assert.equal(canWriteNotes({ manage_notes: { actions: ['update'] } }, 'update'), true);
});

test('suggestSlug lowercases and dashes', () => {
  assert.equal(suggestSlug('Computer Networks  '), 'computer-networks');
  assert.equal(suggestSlug('Engineering Mathematics-I'), 'engineering-mathematics-i');
  assert.equal(suggestSlug('  C++ & DS! '), 'c-ds');
});

test('parseTopicTitles splits lines, skips blanks, de-duplicates', () => {
  assert.deepEqual(parseTopicTitles('Subnetting\n\nIP addressing\nsubnetting\n  IP   addressing '), [
    'Subnetting',
    'IP addressing',
  ]);
  assert.deepEqual(parseTopicTitles('  \n '), []);
});

test('validateSubjectDraft', () => {
  const base = {
    name: 'Computer Networks',
    code: 'CS601',
    semester: '6',
    branches: ['cse'],
    kind: 'theory' as const,
    pyqSubjectId: '',
  };
  assert.equal(validateSubjectDraft(base), null);
  assert.match(validateSubjectDraft({ ...base, name: ' ' })!, /name/i);
  assert.match(validateSubjectDraft({ ...base, semester: '9' })!, /Semester/);
  assert.match(validateSubjectDraft({ ...base, semester: 'x' })!, /Semester/);
  assert.match(validateSubjectDraft({ ...base, branches: [] })!, /branch/i);
  assert.match(validateModuleTitle(' ')!, /title/i);
  assert.match(validateTopicTitle(' ')!, /title/i);
});

test('pickNotesWrite: none / append / small replace / full update', () => {
  assert.equal(pickNotesWrite('a', 'a'), 'none');
  assert.equal(pickNotesWrite('', 'hello'), 'update');
  assert.equal(pickNotesWrite('hello', 'hello\n\n### Q: new?'), 'patch-append');
  assert.equal(pickNotesWrite('fix teh typo', 'fix the typo'), 'patch-replace');
  assert.equal(pickNotesWrite('a'.repeat(100), 'b'.repeat(5000)), 'update');
});

test('deleteConfirmText states the blast radius', () => {
  assert.match(deleteConfirmText('module', { topics: 14, notes: 9 }), /14 topics.*notes on 9/);
  assert.match(deleteConfirmText('topic', { topics: 1, notes: 1 }), /orphaned/);
});

test('writableBranches respects the grant scope', () => {
  assert.deepEqual(
    writableBranches({ manage_syllabus: { actions: ['update'], branches: '*' } }, ['cse', 'ece']),
    ['cse', 'ece']
  );
  assert.deepEqual(
    writableBranches({ manage_syllabus: { actions: ['update'], branches: ['cse'] } }, ['cse', 'ece']),
    ['cse']
  );
  assert.deepEqual(writableBranches(undefined, ['cse']), []);
});
