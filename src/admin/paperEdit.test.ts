import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addNewPages,
  buildCommitPages,
  describeChanges,
  moveSlot,
  newPagesOf,
  removeSlot,
  replaceSlot,
  slotsFromPages,
  summarizeChanges,
  updateNewPage,
  type NewPage,
  type Slot,
} from './paperEdit.ts';

const stored = [
  { publicId: 'p/a', thumbUrl: 'ta', width: 800, height: 1130 },
  { publicId: 'p/b', thumbUrl: 'tb' },
  { publicId: 'p/c', thumbUrl: 'tc' },
];
const np = (n: string): NewPage => ({ uri: `file:///${n}.jpg`, name: `${n}.jpg`, type: 'image/jpeg' });
const ids = (slots: Slot[]) =>
  slots.map((s) => (s.kind === 'existing' ? s.publicId : `new:${s.page.name}`));
const original = stored.map((p) => p.publicId);

test('stored pages become existing slots, in order, with missing sizes as null', () => {
  const s = slotsFromPages(stored);
  assert.deepEqual(ids(s), ['p/a', 'p/b', 'p/c']);
  assert.equal((s[1] as any).width, null);
  assert.equal((s[0] as any).width, 800);
});

test('addNewPages appends at the end and respects the page limit', () => {
  const s = slotsFromPages(stored);
  assert.deepEqual(ids(addNewPages(s, [np('x'), np('y')])), ['p/a', 'p/b', 'p/c', 'new:x.jpg', 'new:y.jpg']);
  assert.equal(addNewPages(s, [np('x'), np('y')], 4).length, 4); // only one fits
  assert.equal(addNewPages(s, [np('x')], 3), s); // full: unchanged
  assert.equal(addNewPages(s, []), s);
});

test('removeSlot drops one page and ignores bad indexes', () => {
  const s = slotsFromPages(stored);
  assert.deepEqual(ids(removeSlot(s, 1)), ['p/a', 'p/c']);
  assert.equal(removeSlot(s, 9), s);
  assert.equal(removeSlot(s, -1), s);
});

test('moveSlot swaps neighbours and refuses to leave the list', () => {
  const s = slotsFromPages(stored);
  assert.deepEqual(ids(moveSlot(s, 1, -1)), ['p/b', 'p/a', 'p/c']);
  assert.deepEqual(ids(moveSlot(s, 1, 1)), ['p/a', 'p/c', 'p/b']);
  assert.equal(moveSlot(s, 0, -1), s);
  assert.equal(moveSlot(s, 2, 1), s);
});

test('replaceSlot turns one page into a new one in place', () => {
  const s = replaceSlot(slotsFromPages(stored), 1, np('fix'));
  assert.deepEqual(ids(s), ['p/a', 'new:fix.jpg', 'p/c']);
});

test('updateNewPage edits only new pages', () => {
  const s = addNewPages(slotsFromPages(stored), [np('x')]);
  const edited = updateNewPage(s, 3, 'file:///cropped.jpg');
  assert.equal((edited[3] as any).page.uri, 'file:///cropped.jpg');
  assert.equal((edited[3] as any).page.name, 'page-4.jpg');
  assert.equal(updateNewPage(s, 0, 'file:///nope.jpg')[0], s[0]); // existing untouched
});

test('summary: nothing changed', () => {
  const c = summarizeChanges(original, slotsFromPages(stored));
  assert.deepEqual(c, { added: 0, removed: 0, reordered: false, kept: 3, changed: false });
  assert.equal(describeChanges(c), '');
});

test('summary: add, remove and reorder are each detected', () => {
  const base = slotsFromPages(stored);
  assert.deepEqual(summarizeChanges(original, addNewPages(base, [np('x')])), {
    added: 1, removed: 0, reordered: false, kept: 3, changed: true,
  });
  assert.deepEqual(summarizeChanges(original, removeSlot(base, 0)), {
    added: 0, removed: 1, reordered: false, kept: 2, changed: true,
  });
  const moved = summarizeChanges(original, moveSlot(base, 0, 1));
  assert.equal(moved.reordered, true);
  assert.equal(moved.changed, true);
  assert.equal(moved.added + moved.removed, 0);
});

test('summary: removing a page is not a reorder of the rest', () => {
  const c = summarizeChanges(original, removeSlot(slotsFromPages(stored), 0));
  assert.equal(c.reordered, false);
});

test('summary: replace = one added, one removed', () => {
  const c = summarizeChanges(original, replaceSlot(slotsFromPages(stored), 1, np('fix')));
  assert.deepEqual(c, { added: 1, removed: 1, reordered: false, kept: 2, changed: true });
  assert.equal(describeChanges(c), '1 added, 1 removed');
});

test('summary: a moved new page does not count as reordering the kept ones', () => {
  const s = moveSlot(addNewPages(slotsFromPages(stored), [np('x')]), 3, -1);
  assert.equal(summarizeChanges(original, s).reordered, false);
});

test('describeChanges joins the parts', () => {
  assert.equal(
    describeChanges({ added: 2, removed: 1, reordered: true, kept: 1, changed: true }),
    '2 added, 1 removed, order changed'
  );
});

test('buildCommitPages uses kept ids as-is and issued ids for new pages, in list order', () => {
  const s = addNewPages(slotsFromPages(stored), [np('x'), np('y')]); // a b c x y
  assert.deepEqual(
    buildCommitPages(s, ['i/1', 'i/2']).map((p) => p.publicId),
    ['p/a', 'p/b', 'p/c', 'i/1', 'i/2']
  );
  // Move y up two places: a b y c x. Issued ids follow the order the NEW pages
  // now appear in (y first, then x), which is also the order they are uploaded.
  const moved = moveSlot(moveSlot(s, 4, -1), 3, -1);
  assert.deepEqual(newPagesOf(moved).map((p) => p.name), ['y.jpg', 'x.jpg']);
  assert.deepEqual(
    buildCommitPages(moved, ['i/1', 'i/2']).map((p) => p.publicId),
    ['p/a', 'p/b', 'i/1', 'p/c', 'i/2']
  );
});

test('newPagesOf lists only the pages to upload, in order', () => {
  const s = addNewPages(slotsFromPages(stored), [np('x'), np('y')]);
  assert.deepEqual(newPagesOf(removeSlot(s, 0)).map((p) => p.name), ['x.jpg', 'y.jpg']);
  assert.deepEqual(newPagesOf(slotsFromPages(stored)), []);
});
