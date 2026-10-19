import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { communityKeys } from '@pyqdeck/community-sdk';
import { persistMeta } from '../api/queryClient';
import { userProfileService } from '../services/userProfileService';
import type { CommunityComment, CommunityPost } from '../types/community';
import { communityClient } from './client';
import { COMMUNITY_SLUG } from './config';
import { toCommunityComment, toCommunityPost } from './mappers';

// Query definitions (key + fetcher + freshness + persistence) for the community, in the same style as src/api/queries.ts.
// Keys come from the SDK and always start with the community, so another app's community can never share an entry.
// Sign-out wipes the query cache (auth/wipeUserData.ts), so per-person flags such as `isLiked` never leak to the next
// account.

const SLUG = COMMUNITY_SLUG;

export const COMMUNITY_STALE = {
  feed: 60 * 1000,
  post: 30 * 1000,
  comments: 30 * 1000,
  profile: 60 * 1000,
  notifications: 30 * 1000,
};

const FEED_PAGE_SIZE = 20;
/** Comments load up to this many top-level comments (with their replies) in one go. */
const MAX_ROOT_COMMENTS = 100;

export interface FeedFilters {
  hashtag?: string | null;
  /** Search text. Ignored under 2 characters, like the server requires. */
  q?: string;
}

/** Equal requests must make equal keys: lower-case tag, trimmed search, nothing for an empty filter. */
export const normalizeFeedFilters = (f: FeedFilters = {}) => {
  const q = f.q?.trim() ?? '';
  return { hashtag: f.hashtag ? f.hashtag.replace(/^#/, '').toLowerCase() : null, q: q.length >= 2 ? q : null };
};

export interface FeedPage {
  items: CommunityPost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const feedQuery = (filters: FeedFilters = {}) => {
  const f = normalizeFeedFilters(filters);
  return infiniteQueryOptions({
    queryKey: communityKeys.feed(SLUG, f),
    queryFn: async ({ pageParam, signal }): Promise<FeedPage> => {
      const page = await communityClient.posts.feed(
        { cursor: pageParam, limit: FEED_PAGE_SIZE, hashtag: f.hashtag ?? undefined, q: f.q ?? undefined },
        { signal }
      );
      return { items: page.items.map(toCommunityPost), nextCursor: page.nextCursor, hasMore: page.hasMore };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: COMMUNITY_STALE.feed,
    // A few pages are enough offline. Searches are throwaway and are not written to disk.
    maxPages: 5,
    meta: f.q ? undefined : persistMeta,
  });
};

export const postQuery = (idOrSlug: string) =>
  queryOptions({
    queryKey: communityKeys.post(SLUG, idOrSlug),
    queryFn: async ({ signal }) => toCommunityPost(await communityClient.posts.get(idOrSlug, { signal })),
    staleTime: COMMUNITY_STALE.post,
    meta: persistMeta,
  });

/** A post's top-level comments, each with its replies, so threads show without another tap. */
export const commentsQuery = (postId: string) =>
  queryOptions({
    queryKey: communityKeys.comments(SLUG, postId),
    queryFn: async ({ signal }): Promise<CommunityComment[]> => {
      const roots = [];
      let cursor: string | undefined;
      do {
        const page = await communityClient.comments.list(postId, { cursor, limit: 50 }, { signal });
        roots.push(...page.items);
        cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined;
      } while (cursor && roots.length < MAX_ROOT_COMMENTS);

      return Promise.all(
        roots.map(async (root) => {
          if (root.repliesCount === 0) return toCommunityComment(root, []);
          const replies = await communityClient.comments.replies(root.id, { limit: 50 }, { signal }).catch(() => null);
          return toCommunityComment(root, replies?.items ?? []);
        })
      );
    },
    staleTime: COMMUNITY_STALE.comments,
  });

export const memberPostsQuery = (username: string) =>
  queryOptions({
    queryKey: communityKeys.memberPosts(SLUG, username),
    queryFn: async ({ signal }) =>
      (await communityClient.posts.byMember(username, { limit: 50 }, { signal })).items.map(toCommunityPost),
    staleTime: COMMUNITY_STALE.feed,
    meta: persistMeta,
  });

export const bookmarksQuery = () =>
  queryOptions({
    queryKey: communityKeys.bookmarks(SLUG),
    queryFn: async ({ signal }) =>
      (await communityClient.posts.bookmarks({ limit: 50 }, { signal })).items.map(toCommunityPost),
    staleTime: COMMUNITY_STALE.feed,
    meta: persistMeta,
  });

/** `userId` is a handle, or `me` for the signed-in person. */
export const profileQuery = (userId: string, ownId?: string | null) => {
  const isOwn = userId === 'me' || (!!ownId && userId === ownId);
  return queryOptions({
    queryKey: isOwn ? communityKeys.me(SLUG) : communityKeys.member(SLUG, userId),
    queryFn: () => userProfileService.getProfile(userId, undefined, ownId ? { id: ownId } : null),
    staleTime: COMMUNITY_STALE.profile,
    meta: persistMeta,
  });
};

export const notificationsQuery = () =>
  queryOptions({
    queryKey: communityKeys.notifications(SLUG, {}),
    queryFn: async ({ signal }) => (await communityClient.notifications.list({ limit: 50 }, { signal })).items,
    staleTime: COMMUNITY_STALE.notifications,
  });

export const unreadCountQuery = (signedIn: boolean) =>
  queryOptions({
    queryKey: [...communityKeys.unreadCount(SLUG), signedIn] as const,
    queryFn: ({ signal }) => (signedIn ? communityClient.notifications.unreadCount({ signal }) : Promise.resolve(0)),
    staleTime: 20 * 1000,
    refetchInterval: signedIn ? 60 * 1000 : false,
  });

// ---- hooks ----

export function useCommunityFeed(filters: FeedFilters = {}) {
  const q = useInfiniteQuery(feedQuery(filters));
  return { ...q, posts: q.data?.pages.flatMap((p) => p.items) ?? [] };
}

export const useCommunityPost = (idOrSlug: string | undefined, initialPost?: CommunityPost) =>
  useQuery({ ...postQuery(idOrSlug ?? ''), enabled: !!idOrSlug, initialData: initialPost, initialDataUpdatedAt: 0 });

export const useCommunityComments = (postId: string | undefined, enabled = true) =>
  useQuery({ ...commentsQuery(postId ?? ''), enabled: enabled && !!postId });

export const useMemberPosts = (username: string | undefined) =>
  useQuery({ ...memberPostsQuery(username ?? ''), enabled: !!username });

export const useBookmarks = (enabled: boolean) => useQuery({ ...bookmarksQuery(), enabled });

export const useCommunityNotifications = (enabled: boolean) => useQuery({ ...notificationsQuery(), enabled });

export const useCommunityUnreadCount = (signedIn: boolean) => useQuery(unreadCountQuery(signedIn)).data ?? 0;
