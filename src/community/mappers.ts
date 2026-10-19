import type { Author, Comment, Member, OwnMember, Post } from '@pyqdeck/community-sdk';
import type { CommunityAuthor, CommunityComment, CommunityPost } from '../types/community';
import type { UserProfileData } from '../services/userProfileService';

/** "Just now", "5m", "2h", "3d", then a date. The API sends ISO times; formatting is the client's job. */
export function shortAgo(iso: string, now = Date.now()): string {
  const secs = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (secs < 45) return 'Just now';
  if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))}m`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h`;
  if (secs < 7 * 86400) return `${Math.round(secs / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const longAgo = (iso: string, now = Date.now()): string => {
  const short = shortAgo(iso, now);
  return /^\d+[mhd]$/.test(short) ? `${short} ago` : short;
};

export function toAuthor(a: Author): CommunityAuthor {
  return {
    // The handle is what the profile screen opens. A deleted member has none and cannot be opened.
    id: a.username ?? 'deleted',
    name: a.displayName,
    avatarUrl: a.avatarUrl || undefined,
    bio: a.headline || undefined,
    badge: a.role === 'member' ? undefined : a.role === 'admin' ? 'Admin' : 'Moderator',
  };
}

export function toCommunityPost(p: Post): CommunityPost {
  return {
    id: p.id,
    slug: p.slug,
    author: toAuthor(p.author),
    createdAt: shortAgo(p.createdAt),
    createdAtIso: p.createdAt,
    editedAt: p.editedAt,
    body: p.body,
    rawBody: p.rawBody,
    hashtags: p.hashtags,
    attachments: p.media.map((m) => ({ id: m.id, type: 'image' as const, url: m.url })),
    linkedResource: p.linkedResource ?? undefined,
    links: p.links,
    likesCount: p.likesCount,
    isLiked: p.isLiked,
    commentsCount: p.commentsCount,
    bookmarksCount: p.bookmarksCount,
    isBookmarked: p.isBookmarked,
    // The server only ever shows pending or rejected posts to their author.
    status: p.status === 'pending' ? 'pending' : p.status === 'rejected' ? 'rejected' : 'published',
    isOwnPost: p.isOwnPost,
    heldReason: p.heldReason,
    removedReason: p.removedReason,
    hasPendingEdit: p.hasPendingEdit,
  };
}

export function toCommunityComment(c: Comment, replies?: Comment[]): CommunityComment {
  return {
    id: c.id,
    postId: c.postId,
    author: toAuthor(c.author),
    body: c.body,
    rawBody: c.rawBody,
    createdAt: longAgo(c.createdAt),
    createdAtIso: c.createdAt,
    editedAt: c.editedAt,
    likesCount: c.likesCount,
    isLiked: c.isLiked,
    parentId: c.parentId ?? undefined,
    replyToAuthorName: c.replyTo?.displayName,
    repliesCount: c.repliesCount,
    isOwn: c.isOwn,
    status: c.status === 'pending' ? 'pending' : c.status === 'rejected' ? 'rejected' : 'published',
    replies: replies?.map((r) => toCommunityComment(r)),
  };
}

const attr = (m: Member, key: string): string => {
  const v = m.attributes?.[key];
  return v === undefined || v === null ? '' : String(v);
};

/**
 * Member -> the profile screen's shape. Academic details live in the community's free-form `attributes`
 * (college, university, branch, semester, gradYear for BEU); `headline` is the app's one-line `bio` and the member's
 * `bio` is the app's `about`.
 */
export function toProfile(m: Member | OwnMember): UserProfileData {
  return {
    id: m.username ?? 'deleted',
    name: m.displayName,
    avatarUrl: m.avatarUrl || undefined,
    coverUrl: m.coverUrl || undefined,
    bio: m.headline,
    about: m.bio,
    college: attr(m, 'college'),
    university: attr(m, 'university'),
    branch: attr(m, 'branch'),
    semester: attr(m, 'semester'),
    gradYear: attr(m, 'gradYear'),
    location: m.location,
    github: m.github,
    linkedin: m.linkedin,
    website: m.website,
    twitter: m.twitter,
    skills: m.skills,
    followersCount: m.followersCount,
    followingCount: m.followingCount,
    isFollowing: m.isFollowing,
    contributionsCount: m.postsCount,
    upvotesCount: m.upvotesCount,
  };
}
