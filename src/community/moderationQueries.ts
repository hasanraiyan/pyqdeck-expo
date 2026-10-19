import { infiniteQueryOptions, queryOptions, useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { communityKeys } from '@pyqdeck/community-sdk';
import type { ModerationEventFilter } from '@pyqdeck/community-sdk';
import { communityClient } from './client';
import { COMMUNITY_SLUG } from './config';
import { profileQuery } from './queries';

// Everything the moderation screens read. Moderators and admins only: the server answers 403 to everyone else, and the
// app only shows the entry point to staff. None of this is saved offline (it is short-lived work in progress).

const SLUG = COMMUNITY_SLUG;

export const moderationKeys = {
  all: () => [...communityKeys.all(SLUG), 'moderation'] as const,
  held: () => [...moderationKeys.all(), 'held'] as const,
  reports: () => [...moderationKeys.all(), 'reports'] as const,
  events: (filter: ModerationEventFilter) => [...moderationKeys.all(), 'events', filter] as const,
};

/** Posts and comments waiting for a moderator: held by the AI check, hidden by reports, or an edit waiting. */
export const heldQuery = () =>
  queryOptions({
    queryKey: moderationKeys.held(),
    queryFn: async ({ signal }) => {
      const [posts, comments] = await Promise.all([
        communityClient.posts.queue({ limit: 50 }, { signal }),
        communityClient.comments.queue({ limit: 50 }, { signal }),
      ]);
      return { posts: posts.items, comments: comments.items };
    },
    staleTime: 10 * 1000,
  });

/** Open reports grouped by what was reported, worst first. */
export const reportsQuery = () =>
  queryOptions({
    queryKey: moderationKeys.reports(),
    queryFn: ({ signal }) => communityClient.reports.queue({ limit: 50 }, { signal }),
    staleTime: 10 * 1000,
  });

/** The history of every content check, newest first, page by page. */
export const eventsQuery = (filter: Omit<ModerationEventFilter, 'page'> = {}) =>
  infiniteQueryOptions({
    queryKey: moderationKeys.events(filter),
    queryFn: ({ pageParam, signal }) =>
      communityClient.moderation.events({ ...filter, page: pageParam, limit: 30 }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page.hasNext ? last.page.page + 1 : undefined),
    staleTime: 10 * 1000,
  });

export type CommunityRole = 'member' | 'moderator' | 'admin';

/** The signed-in person's role in this community. Everyone else (and signed-out visitors) is a plain member. */
export function useCommunityRole(): CommunityRole {
  const { isSignedIn } = useAuth();
  const me = useQuery({ ...profileQuery('me'), enabled: !!isSignedIn });
  return isSignedIn ? (me.data?.role ?? 'member') : 'member';
}

export const useIsStaff = () => useCommunityRole() !== 'member';

/** How much is waiting for a moderator, for the badge on the header icon. Only fetched for staff. */
export function useModerationBacklog(enabled: boolean): number {
  const held = useQuery({ ...heldQuery(), enabled, refetchInterval: enabled ? 60 * 1000 : false });
  const reports = useQuery({ ...reportsQuery(), enabled, refetchInterval: enabled ? 60 * 1000 : false });
  return (held.data ? held.data.posts.length + held.data.comments.length : 0) + (reports.data?.length ?? 0);
}
