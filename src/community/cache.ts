import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import { communityKeys } from '@pyqdeck/community-sdk';
import { queryClient } from '../api/queryClient';
import type { CommunityComment, CommunityPost } from '../types/community';
import { COMMUNITY_SLUG } from './config';
import { addCommentToTree, mapCommentTree, mapPostData, rootOf } from './cacheMap';
import type { FeedPage } from './queries';

// Optimistic edits to the cached community data. A post can sit in several caches at once (the feed with and without
// a filter, a profile's posts, saved posts, its own detail entry), so a change is applied to all of them.

const SLUG = COMMUNITY_SLUG;
type Snapshot = Array<[QueryKey, unknown]>;

/** The query-key section of a community entry: ['community', slug, SECTION, ...]. */
const section = (key: QueryKey) => key[2];
const POST_SECTIONS = new Set(['feed', 'post', 'member-posts', 'bookmarks']);

/** Everything cached for this community, so a failed change can be undone exactly. */
export const snapshotCommunity = (): Snapshot => queryClient.getQueriesData({ queryKey: communityKeys.all(SLUG) });

export function restoreCommunity(snapshot: Snapshot) {
  for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
}

/** Applies `patch` to the post with this id in every cache that holds it. Returns the post as it was, if found. */
export function patchPost(id: string, patch: Partial<CommunityPost> | ((p: CommunityPost) => Partial<CommunityPost>)) {
  let before: CommunityPost | undefined;
  for (const [key] of queryClient.getQueriesData({ queryKey: communityKeys.all(SLUG) })) {
    if (!POST_SECTIONS.has(String(section(key)))) continue;
    queryClient.setQueryData(key, (old: unknown) =>
      mapPostData(old, (p) => {
        if (p.id !== id) return p;
        before ??= p;
        return { ...p, ...(typeof patch === 'function' ? patch(p) : patch) };
      })
    );
  }
  return before;
}

/** Drops a post from every list and its detail entry (deleted, or hidden from this person's feed). */
export function removePostFromCache(id: string, opts: { detail?: boolean } = { detail: true }) {
  for (const [key] of queryClient.getQueriesData({ queryKey: communityKeys.all(SLUG) })) {
    const name = String(section(key));
    if (!POST_SECTIONS.has(name)) continue;
    if (name === 'post') {
      if (opts.detail && (key[3] as string) === id) queryClient.removeQueries({ queryKey: key, exact: true });
      continue;
    }
    queryClient.setQueryData(key, (old: unknown) => mapPostData(old, (p) => (p.id === id ? null : p)));
  }
}

/** Finds a post wherever it is cached. */
export function findCachedPost(id: string): CommunityPost | undefined {
  let found: CommunityPost | undefined;
  for (const [key, data] of queryClient.getQueriesData({ queryKey: communityKeys.all(SLUG) })) {
    if (!POST_SECTIONS.has(String(section(key)))) continue;
    mapPostData(data, (p) => {
      if (p.id === id) found ??= p;
      return p;
    });
    if (found) break;
  }
  return found;
}

/** Puts a freshly published post at the top of the unfiltered feed and in its own detail entry. */
export function addPostToFeed(post: CommunityPost) {
  queryClient.setQueryData(communityKeys.post(SLUG, post.id), post);
  for (const [key, data] of queryClient.getQueriesData<InfiniteData<FeedPage>>({ queryKey: communityKeys.feeds(SLUG) })) {
    const filters = key[3] as { hashtag?: string | null; q?: string | null } | undefined;
    if (filters?.hashtag || filters?.q || !data?.pages?.length) continue;
    const [first, ...rest] = data.pages;
    queryClient.setQueryData(key, {
      ...data,
      pages: [{ ...first, items: [post, ...first.items.filter((p) => p.id !== post.id)] }, ...rest],
    });
  }
  // Filtered feeds and the author's profile list just need a fresh look next time they are opened.
  void queryClient.invalidateQueries({
    queryKey: communityKeys.feeds(SLUG),
    refetchType: 'none',
  });
  void queryClient.invalidateQueries({ queryKey: [...communityKeys.all(SLUG), 'member-posts'], refetchType: 'none' });
}

// ---- comments ----

export function patchComment(postId: string, commentId: string, patch: (c: CommunityComment) => Partial<CommunityComment>) {
  queryClient.setQueryData<CommunityComment[]>(communityKeys.comments(SLUG, postId), (old) =>
    old ? mapCommentTree(old, (c) => (c.id === commentId ? { ...c, ...patch(c) } : c)) : old
  );
}

export function removeComment(postId: string, commentId: string) {
  queryClient.setQueryData<CommunityComment[]>(communityKeys.comments(SLUG, postId), (old) =>
    old ? mapCommentTree(old, (c) => (c.id === commentId ? null : c)) : old
  );
}

/** Adds a comment: top level, or under its thread's root (wherever in the thread the reply was started). */
export function insertComment(postId: string, comment: CommunityComment, threadParentId?: string) {
  queryClient.setQueryData<CommunityComment[]>(communityKeys.comments(SLUG, postId), (old = []) =>
    addCommentToTree(old, comment, threadParentId)
  );
}

export function replaceComment(postId: string, tempId: string, real: CommunityComment) {
  queryClient.setQueryData<CommunityComment[]>(communityKeys.comments(SLUG, postId), (old) =>
    old ? mapCommentTree(old, (c) => (c.id === tempId ? { ...real, replies: c.replies } : c)) : old
  );
}

export function findRootOf(postId: string, commentId: string): string {
  return rootOf(queryClient.getQueryData<CommunityComment[]>(communityKeys.comments(SLUG, postId)) ?? [], commentId);
}
