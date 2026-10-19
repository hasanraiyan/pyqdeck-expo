import { Alert } from 'react-native';
import { CommunityApiError, communityKeys, newIdempotencyKey } from '@pyqdeck/community-sdk';
import type { ReportReason } from '@pyqdeck/community-sdk';
import { queryClient } from '../api/queryClient';
import type { CommunityComment, CommunityPost } from '../types/community';
import {
  findCachedPost,
  findRootOf,
  insertComment,
  patchComment,
  patchPost,
  removeComment,
  removePostFromCache,
  replaceComment,
  restoreCommunity,
  snapshotCommunity,
} from './cache';
import { communityClient } from './client';
import { COMMUNITY_SLUG } from './config';
import { alertCommunityError } from './errors';
import { toCommunityComment, toCommunityPost } from './mappers';

// Everything a person can DO in the community. Each action updates the cached data at once (optimistic), asks the
// server, then settles on the server's answer, or puts everything back and explains if it was refused.

const SLUG = COMMUNITY_SLUG;

// ---- like: optimistic patch + debounced commit (Twitter/LinkedIn/YouTube pattern) ----

/**
 * Immediately patches the local cache so the UI flips without waiting for
 * the network. Called on every tap by useDebouncedToggle.
 */
export function optimisticLikePost(postId: string, liked: boolean): void {
  patchPost(postId, (p) => ({
    isLiked: liked,
    likesCount: Math.max(0, p.likesCount + (liked ? 1 : -1)),
  }));
}

/**
 * Commits the final like/unlike to the server. Called once per tap-burst
 * (after the debounce window) by useDebouncedToggle. On error the cache is
 * restored and the user is alerted.
 */
export async function commitLikePost(postId: string, liked: boolean): Promise<void> {
  const snapshot = snapshotCommunity();
  try {
    const res = liked
      ? await communityClient.posts.like(postId)
      : await communityClient.posts.unlike(postId);
    // Settle to server truth in case the count drifted during rapid taps.
    patchPost(postId, { isLiked: res.isLiked, likesCount: res.likesCount });
  } catch (err) {
    restoreCommunity(snapshot);
    alertCommunityError(err, liked ? 'Could not like this post' : 'Could not remove your like');
  }
}

/** Legacy all-in-one wrapper — kept so any caller that isn't using the card can still use it. */
export async function toggleLikePost(postId: string): Promise<void> {
  const current = findCachedPost(postId);
  if (!current) return;
  const liked = !current.isLiked;
  optimisticLikePost(postId, liked);
  await commitLikePost(postId, liked);
}

// ---- bookmark: same pattern ----

/**
 * Immediately patches the local cache for a bookmark toggle.
 */
export function optimisticBookmarkPost(postId: string, saved: boolean): void {
  patchPost(postId, (p) => ({
    isBookmarked: saved,
    bookmarksCount: Math.max(0, p.bookmarksCount + (saved ? 1 : -1)),
  }));
}

/**
 * Commits the final bookmark/unbookmark to the server.
 */
export async function commitBookmarkPost(postId: string, saved: boolean): Promise<void> {
  const snapshot = snapshotCommunity();
  try {
    const res = saved
      ? await communityClient.posts.bookmark(postId)
      : await communityClient.posts.unbookmark(postId);
    patchPost(postId, { isBookmarked: res.isBookmarked, bookmarksCount: res.bookmarksCount });
    void queryClient.invalidateQueries({ queryKey: communityKeys.bookmarks(SLUG) });
  } catch (err) {
    restoreCommunity(snapshot);
    alertCommunityError(err, 'Could not save this post');
  }
}

/** Legacy all-in-one wrapper. */
export async function toggleBookmarkPost(postId: string): Promise<void> {
  const current = findCachedPost(postId);
  if (!current) return;
  const saved = !current.isBookmarked;
  optimisticBookmarkPost(postId, saved);
  await commitBookmarkPost(postId, saved);
}

/** "Hide from my feed". Remembered by the server across sessions. */
export async function hidePost(postId: string): Promise<void> {
  const snapshot = snapshotCommunity();
  removePostFromCache(postId, { detail: false });
  try {
    await communityClient.posts.hide(postId);
  } catch (err) {
    restoreCommunity(snapshot);
    alertCommunityError(err, 'Could not hide this post');
  }
}

export async function deletePost(postId: string): Promise<boolean> {
  const snapshot = snapshotCommunity();
  removePostFromCache(postId);
  try {
    await communityClient.posts.delete(postId);
  } catch (err) {
    if (!(err instanceof CommunityApiError && err.status === 404)) {
      restoreCommunity(snapshot);
      alertCommunityError(err, 'Could not delete this post');
      return false;
    }
  }
  queryClient.removeQueries({ queryKey: communityKeys.comments(SLUG, postId) });
  void queryClient.invalidateQueries({ queryKey: [...communityKeys.all(SLUG), 'me'] });
  return true;
}

export async function editPost(postId: string, body: string): Promise<CommunityPost | undefined> {
  try {
    const post = toCommunityPost(await communityClient.posts.edit(postId, { body }));
    patchPost(postId, post);
    if (post.hasPendingEdit) {
      Alert.alert('Edit under review', 'Your edit is being reviewed. The previous version stays visible until then.');
    }
    return post;
  } catch (err) {
    alertCommunityError(err, 'Could not save your edit');
    return undefined;
  }
}

export async function reportContent(
  targetType: 'post' | 'comment' | 'member',
  targetId: string,
  reason: ReportReason = 'other',
  note?: string
): Promise<boolean> {
  try {
    await communityClient.reports.create({ targetType, targetId, reason, note });
    return true;
  } catch (err) {
    alertCommunityError(err, 'Could not send your report');
    return false;
  }
}

// ---- comments ----

/**
 * Adds a comment or a reply. `parentCommentId` may be any comment of the thread; the server attaches the reply to the
 * thread's top-level comment and remembers who it answers. The comment shows at once and is replaced by the real one.
 */
export async function addComment(
  postId: string,
  text: string,
  parentCommentId?: string,
  replyToAuthorName?: string
): Promise<void> {
  const tempId = `temp-${Date.now()}`;
  const temp: CommunityComment = {
    id: tempId,
    postId,
    parentId: parentCommentId ? findRootOf(postId, parentCommentId) : undefined,
    replyToAuthorName,
    author: { id: 'me', name: 'You' },
    body: text,
    createdAt: 'Just now',
    likesCount: 0,
    isLiked: false,
    isOwn: true,
    replies: [],
  };
  const snapshot = snapshotCommunity();
  insertComment(postId, temp, parentCommentId);
  patchPost(postId, (p) => ({ commentsCount: p.commentsCount + 1 }));
  try {
    const created = await communityClient.comments.create(
      postId,
      { body: text, parentId: parentCommentId },
      { idempotencyKey: newIdempotencyKey() }
    );
    replaceComment(postId, tempId, toCommunityComment(created, []));
    if (created.status === 'pending') {
      // Held comments do not count for others until a moderator approves them.
      patchPost(postId, (p) => ({ commentsCount: Math.max(0, p.commentsCount - 1) }));
      Alert.alert('Comment under review', 'A moderator will check your comment before it appears to others.');
    }
  } catch (err) {
    restoreCommunity(snapshot);
    alertCommunityError(err, "Couldn't post your comment");
  }
}

// ---- comment like: optimistic patch + debounced commit ----

export function optimisticLikeComment(postId: string, commentId: string, liked: boolean): void {
  patchComment(postId, commentId, (c) => ({
    isLiked: liked,
    likesCount: Math.max(0, c.likesCount + (liked ? 1 : -1)),
  }));
}

export async function commitLikeComment(postId: string, commentId: string, liked: boolean): Promise<void> {
  const snapshot = snapshotCommunity();
  try {
    const res = liked
      ? await communityClient.comments.like(commentId)
      : await communityClient.comments.unlike(commentId);
    patchComment(postId, commentId, () => ({ isLiked: res.isLiked, likesCount: res.likesCount }));
  } catch (err) {
    restoreCommunity(snapshot);
    alertCommunityError(err, 'Could not like this comment');
  }
}

export async function toggleLikeComment(postId: string, commentId: string): Promise<void> {
  let liked = false;
  const snapshot = snapshotCommunity();
  patchComment(postId, commentId, (c) => {
    liked = !c.isLiked;
    return { isLiked: liked, likesCount: Math.max(0, c.likesCount + (liked ? 1 : -1)) };
  });
  try {
    const res = liked ? await communityClient.comments.like(commentId) : await communityClient.comments.unlike(commentId);
    patchComment(postId, commentId, () => ({ isLiked: res.isLiked, likesCount: res.likesCount }));
  } catch (err) {
    restoreCommunity(snapshot);
    alertCommunityError(err, 'Could not like this comment');
  }
}

export async function deleteComment(postId: string, commentId: string): Promise<boolean> {
  const snapshot = snapshotCommunity();
  removeComment(postId, commentId);
  try {
    await communityClient.comments.delete(commentId);
  } catch (err) {
    if (!(err instanceof CommunityApiError && err.status === 404)) {
      restoreCommunity(snapshot);
      alertCommunityError(err, 'Could not delete this comment');
      return false;
    }
  }
  // A deleted thread takes its replies with it, so counts are re-read from the server rather than guessed.
  void queryClient.invalidateQueries({ queryKey: communityKeys.comments(SLUG, postId) });
  void queryClient.invalidateQueries({ queryKey: communityKeys.post(SLUG, postId) });
  void queryClient.invalidateQueries({ queryKey: communityKeys.feeds(SLUG), refetchType: 'none' });
  return true;
}

// ---- people ----

export async function markAllNotificationsRead(): Promise<void> {
  await communityClient.notifications.markAllRead();
  void queryClient.invalidateQueries({ queryKey: [...communityKeys.all(SLUG), 'unread-count'] });
}
