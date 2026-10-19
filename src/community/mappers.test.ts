import test from 'node:test';
import assert from 'node:assert/strict';
import { longAgo, shortAgo, toAuthor, toCommunityPost, toProfile } from './mappers';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

test('relative times read like the app\'s own labels', () => {
  assert.equal(shortAgo(ago(10_000), NOW), 'Just now');
  assert.equal(shortAgo(ago(5 * 60_000), NOW), '5m');
  assert.equal(shortAgo(ago(2 * 3_600_000), NOW), '2h');
  assert.equal(shortAgo(ago(3 * 86_400_000), NOW), '3d');
  assert.equal(longAgo(ago(2 * 3_600_000), NOW), '2h ago');
  assert.equal(longAgo(ago(10_000), NOW), 'Just now');
});

test('a deleted author has no handle to open', () => {
  const author = toAuthor({ id: null, username: null, displayName: 'Deleted user', avatarUrl: '', headline: '', role: 'member' });
  assert.equal(author.id, 'deleted');
  assert.equal(author.avatarUrl, undefined);
});

test('staff get a badge, members do not', () => {
  const base = { id: '1', username: 'a', displayName: 'A', avatarUrl: '', headline: 'ECE', role: 'member' as const };
  assert.equal(toAuthor(base).badge, undefined);
  assert.equal(toAuthor({ ...base, role: 'moderator' }).badge, 'Moderator');
  assert.equal(toAuthor({ ...base, role: 'admin' }).badge, 'Admin');
});

test('a post maps to the shape the feed already renders', () => {
  const post = toCommunityPost({
    id: 'p1',
    slug: 's',
    author: { id: 'm1', username: 'alice', displayName: 'Alice', avatarUrl: 'https://a/b.png', headline: 'CSE', role: 'member' },
    body: 'hello https://go.pyqdeck.in/abcd1234',
    hashtags: ['dsa'],
    media: [{ id: 'x', url: 'https://img/1.jpg' }],
    linkedResource: null,
    links: [{ code: 'abcd1234', shortUrl: 'https://go.pyqdeck.in/abcd1234', host: 'example.com' }],
    status: 'pending',
    likesCount: 2,
    commentsCount: 1,
    bookmarksCount: 0,
    isLiked: true,
    isBookmarked: false,
    isOwnPost: true,
    editedAt: null,
    createdAt: new Date().toISOString(),
  });
  assert.equal(post.author.id, 'alice');
  assert.equal(post.status, 'pending');
  assert.deepEqual(post.attachments, [{ id: 'x', type: 'image', url: 'https://img/1.jpg' }]);
  assert.equal(post.linkedResource, undefined);
  assert.equal(post.links?.[0].host, 'example.com');
});

test('profile fields follow the app\'s naming: headline is `bio`, bio is `about`', () => {
  const profile = toProfile({
    id: 'm1',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: '',
    headline: 'ECE 6th sem',
    role: 'member',
    coverUrl: '',
    bio: 'Long text',
    location: 'Patna',
    github: 'alice',
    linkedin: '',
    twitter: '',
    website: '',
    websiteLink: null,
    skills: ['C'],
    attributes: { college: 'GEC Patna', semester: '6th Semester', gradYear: 2026 },
    followersCount: 3,
    followingCount: 4,
    postsCount: 5,
    upvotesCount: 6,
    joinedAt: new Date().toISOString(),
  });
  assert.equal(profile.bio, 'ECE 6th sem');
  assert.equal(profile.about, 'Long text');
  assert.equal(profile.college, 'GEC Patna');
  assert.equal(profile.gradYear, '2026');
  assert.equal(profile.contributionsCount, 5);
  assert.equal(profile.branch, '');
});
