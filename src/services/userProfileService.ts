import { CommunityApiError } from '@pyqdeck/community-sdk';
import type { OwnMember, ProfileUpdate } from '@pyqdeck/community-sdk';
import { communityClient } from '../community/client';
import { toProfile } from '../community/mappers';
import { prepareImage } from '../community/prepareImages';
import { CommunityAuthor } from '../types/community';

export interface UserProfileData {
  /** The member's handle in this community. */
  id: string;
  name: string;
  avatarUrl?: string;
  coverUrl?: string;
  /** One-line headline. */
  bio: string;
  /** Long description. */
  about?: string;
  college: string;
  university: string;
  branch: string;
  semester: string;
  gradYear?: string;
  location?: string;
  github?: string;
  linkedin?: string;
  website?: string;
  twitter?: string;
  skills: string[];
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
  contributionsCount: number;
  upvotesCount: number;
}

const isLocalFile = (uri?: string) => !!uri && /^(file|content|ph|assets-library):/i.test(uri);

/**
 * Profiles come from the Community API. A person has a separate profile in each community (here: BEU), prefilled
 * from their Clerk account when they first use it and edited independently afterwards.
 */
class UserProfileService {
  private own: OwnMember | null = null;
  private following = new Map<string, boolean>();

  /** `userId` is a handle, or `me` / the Clerk id for the signed-in person's own profile. */
  async getProfile(
    userId: string,
    _authorHint?: CommunityAuthor,
    clerkUser?: { id?: string } | null
  ): Promise<UserProfileData> {
    const isOwn = userId === 'me' || (!!clerkUser?.id && userId === clerkUser.id);
    if (isOwn) {
      this.own = await communityClient.members.me();
      return toProfile(this.own);
    }
    const member = await communityClient.members.get(userId);
    this.following.set(member.username ?? userId, !!member.isFollowing);
    return toProfile(member);
  }

  /** The signed-in member as last loaded, or null before the first load. */
  getCachedOwn(): OwnMember | null {
    return this.own;
  }

  async updateOwnProfile(updates: Partial<UserProfileData>): Promise<UserProfileData> {
    const patch: ProfileUpdate = {};
    if (updates.name !== undefined) patch.displayName = updates.name;
    if (updates.bio !== undefined) patch.headline = updates.bio;
    if (updates.about !== undefined) patch.bio = updates.about;
    if (updates.location !== undefined) patch.location = updates.location;
    if (updates.github !== undefined) patch.github = updates.github;
    if (updates.linkedin !== undefined) patch.linkedin = updates.linkedin;
    if (updates.twitter !== undefined) patch.twitter = updates.twitter;
    if (updates.website !== undefined) patch.website = updates.website;
    if (updates.skills !== undefined) patch.skills = updates.skills;

    const attributes: Record<string, string> = {};
    for (const key of ['college', 'university', 'branch', 'semester', 'gradYear'] as const) {
      if (updates[key] !== undefined) attributes[key] = updates[key] ?? '';
    }
    if (Object.keys(attributes).length > 0) {
      patch.attributes = { ...(this.own?.attributes ?? {}), ...attributes };
    }

    // A freshly picked photo is a local file: it goes through the same direct-upload path as post images, and the
    // profile then points at the uploaded media. An already-hosted URL is left as it is.
    for (const [field, mediaField] of [
      ['avatarUrl', 'avatarMediaId'],
      ['coverUrl', 'coverMediaId'],
    ] as const) {
      const value = updates[field];
      if (value === undefined) continue;
      if (!value) patch[mediaField] = null;
      else if (isLocalFile(value)) {
        const [uploaded] = await communityClient.media.uploadImages([await prepareImage(value)]);
        patch[mediaField] = uploaded.id;
      }
    }

    this.own =
      Object.keys(patch).length > 0
        ? await communityClient.members.updateMe(patch)
        : await communityClient.members.me();
    return toProfile(this.own);
  }

  /** Follows or unfollows and returns the new state. Load the profile first so the current state is known. */
  async toggleFollowUser(userId: string): Promise<boolean> {
    const next = !(this.following.get(userId) ?? false);
    if (next) await communityClient.members.follow(userId);
    else await communityClient.members.unfollow(userId);
    this.following.set(userId, next);
    return next;
  }

  async blockUser(userId: string): Promise<void> {
    await communityClient.members.block(userId);
  }
}

export const userProfileService = new UserProfileService();

/** Re-exported so screens can branch on API failures without importing the SDK. */
export { CommunityApiError };
