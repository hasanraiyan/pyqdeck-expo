import type { InfiniteData } from '@tanstack/react-query';
import type { CommunityComment, CommunityPost } from '../types/community';

// Pure helpers for editing cached community data. They never touch the query client, so they can be tested alone.

export interface PostPageLike {
  items: CommunityPost[];
}

export const isPost = (v: unknown): v is CommunityPost =>
  !!v && typeof v === 'object' && 'slug' in v && 'author' in v && 'body' in v;

/**
 * Applies `fn` to every post inside a cached value of any of the shapes the community caches hold: an infinite feed
 * (`pages[].items`), a plain list of posts, or one post. Returning null from `fn` removes that post from a list.
 */
export function mapPostData(data: unknown, fn: (p: CommunityPost) => CommunityPost | null): unknown {
  if (!data) return data;
  const infinite = data as InfiniteData<PostPageLike>;
  if (Array.isArray(infinite.pages)) {
    return {
      ...infinite,
      pages: infinite.pages.map((page) => ({
        ...page,
        items: page.items.flatMap((p) => {
          const next = fn(p);
          return next ? [next] : [];
        }),
      })),
    };
  }
  if (Array.isArray(data)) {
    return (data as unknown[]).flatMap((p) => {
      if (!isPost(p)) return [p];
      const next = fn(p);
      return next ? [next] : [];
    });
  }
  if (isPost(data)) return fn(data) ?? data;
  return data;
}

type CommentFn = (c: CommunityComment) => CommunityComment | null;

/** Applies `fn` to every comment and reply; null removes it (a removed root takes its replies with it). */
export function mapCommentTree(list: CommunityComment[], fn: CommentFn): CommunityComment[] {
  return list.flatMap((c) => {
    const next = fn(c);
    if (!next) return [];
    return [next.replies?.length ? { ...next, replies: mapCommentTree(next.replies, fn) } : next];
  });
}

/** The thread root of any comment of a thread (the comment itself when it is a root or unknown). */
export const rootOf = (list: CommunityComment[], commentId: string) =>
  list.find((c) => c.id === commentId || c.replies?.some((r) => r.id === commentId))?.id ?? commentId;

/** Adds a comment at the top level, or under the thread root of `threadParentId` (any comment of that thread). */
export function addCommentToTree(list: CommunityComment[], comment: CommunityComment, threadParentId?: string) {
  if (!threadParentId) return [...list, comment];
  const root = rootOf(list, threadParentId);
  return list.map((c) =>
    c.id === root ? { ...c, replies: [...(c.replies ?? []), comment], repliesCount: (c.repliesCount ?? 0) + 1 } : c
  );
}
