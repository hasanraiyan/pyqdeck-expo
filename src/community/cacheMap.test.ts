import test from 'node:test';
import assert from 'node:assert/strict';
import { addCommentToTree, mapCommentTree, mapPostData, rootOf } from './cacheMap';
import type { CommunityComment, CommunityPost } from '../types/community';

const post = (id: string, over: Partial<CommunityPost> = {}): CommunityPost => ({
  id,
  slug: `s-${id}`,
  author: { id: 'a', name: 'A' },
  createdAt: '1h',
  body: `body ${id}`,
  hashtags: [],
  attachments: [],
  likesCount: 0,
  isLiked: false,
  commentsCount: 0,
  bookmarksCount: 0,
  isBookmarked: false,
  status: 'published',
  ...over,
});

const comment = (id: string, over: Partial<CommunityComment> = {}): CommunityComment => ({
  id,
  postId: 'p',
  author: { id: 'a', name: 'A' },
  body: id,
  createdAt: '1h ago',
  likesCount: 0,
  isLiked: false,
  ...over,
});

test('edits a post inside an infinite feed, a plain list and a single entry alike', () => {
  const like = (p: CommunityPost) => (p.id === '2' ? { ...p, isLiked: true } : p);
  const feed = { pages: [{ items: [post('1'), post('2')] }, { items: [post('3')] }], pageParams: [] };
  const out = mapPostData(feed, like) as typeof feed;
  assert.equal(out.pages[0].items[1].isLiked, true);
  assert.equal(out.pages[0].items[0].isLiked, false);
  assert.equal(out.pages[1].items.length, 1);

  const list = mapPostData([post('1'), post('2')], like) as CommunityPost[];
  assert.equal(list[1].isLiked, true);
  assert.equal((mapPostData(post('2'), like) as CommunityPost).isLiked, true);
});

test('returning null removes a post from a list but never empties a single entry', () => {
  const drop = (p: CommunityPost) => (p.id === '2' ? null : p);
  const feed = { pages: [{ items: [post('1'), post('2')] }], pageParams: [] };
  assert.deepEqual(
    (mapPostData(feed, drop) as typeof feed).pages[0].items.map((p) => p.id),
    ['1']
  );
  assert.deepEqual(
    (mapPostData([post('2'), post('3')], drop) as CommunityPost[]).map((p) => p.id),
    ['3']
  );
  assert.equal((mapPostData(post('2'), drop) as CommunityPost).id, '2');
});

test('leaves unrelated cached values alone', () => {
  assert.equal(mapPostData(undefined, (p) => p), undefined);
  assert.deepEqual(mapPostData({ count: 3 }, (p) => p), { count: 3 });
  assert.deepEqual(mapPostData([1, 2], (p) => p), [1, 2]);
});

test('a reply to a reply lands under the thread root', () => {
  const tree = [comment('root', { replies: [comment('r1', { parentId: 'root' })], repliesCount: 1 }), comment('other')];
  const out = addCommentToTree(tree, comment('r2'), 'r1');
  assert.deepEqual(
    out[0].replies?.map((r) => r.id),
    ['r1', 'r2']
  );
  assert.equal(out[0].repliesCount, 2);
  assert.equal(out[1].replies, undefined);
  assert.equal(rootOf(tree, 'r1'), 'root');
  assert.equal(rootOf(tree, 'other'), 'other');
});

test('a top-level comment is appended; deleting a root removes its whole thread', () => {
  const tree = [comment('root', { replies: [comment('r1')] })];
  assert.deepEqual(
    addCommentToTree(tree, comment('new')).map((c) => c.id),
    ['root', 'new']
  );
  assert.deepEqual(
    mapCommentTree(tree, (c) => (c.id === 'root' ? null : c)),
    []
  );
  const edited = mapCommentTree(tree, (c) => (c.id === 'r1' ? { ...c, isLiked: true } : c));
  assert.equal(edited[0].replies?.[0].isLiked, true);
});
