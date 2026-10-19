import { createCommunityClient } from '@pyqdeck/community-sdk';
import { getAuthToken } from '../auth/token';
import { COMMUNITY_API_URL, COMMUNITY_SLUG } from './config';

/**
 * The one SDK client for this app's community. It uses the same Clerk token source as the main API client
 * (src/auth/token.ts) but its own origin and error handling.
 */
export const communityClient = createCommunityClient({
  baseUrl: COMMUNITY_API_URL,
  community: COMMUNITY_SLUG,
  getToken: getAuthToken,
});
