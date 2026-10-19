export interface CommunityAuthor {
  /** The member handle: what the profile screen opens. "deleted" for a deleted member. */
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string; // e.g. "Computer Science & Engineering • 3rd Year"
  badge?: string;
  college?: string;
}

export interface CommunityAttachment {
  id: string;
  type: 'image' | 'pdf';
  url: string;
  thumbnailUrl?: string;
  name?: string;
  size?: string;
  pageCount?: number;
  previewPages?: string[]; // High-res preview pages for documents / multi-page slides
}

export interface CommunityLinkedResource {
  type: 'pyq' | 'topic';
  title: string;
  subtitle?: string;
  subjectId?: string;
  semesterId?: string;
  year?: number;
  questionId?: string;
  topicId?: string;
}

export type CommunityPostStatus = 'published' | 'pending' | 'rejected';

export interface CommunityPost {
  id: string;
  slug: string;
  author: CommunityAuthor;
  createdAt: string; // e.g. '2h'
  body: string;
  hashtags: string[];
  attachments: CommunityAttachment[];
  linkedResource?: CommunityLinkedResource;
  likesCount: number;
  isLiked: boolean;
  commentsCount: number;
  bookmarksCount: number;
  isBookmarked: boolean;
  status: CommunityPostStatus;
  isOwnPost?: boolean;
  // Filled from the Community API:
  /** ISO time, for sorting and the exact date. `createdAt` is the short "2h" label. */
  createdAtIso?: string;
  editedAt?: string | null;
  /** The text as typed (own posts), for the edit form. `body` has short links substituted. */
  rawBody?: string;
  /** Why a post is held or removed (own posts only). */
  heldReason?: "moderation" | "reports" | null;
  removedReason?: string | null;
  hasPendingEdit?: boolean;
  /** Destination hosts of the links in the text, to show where a link goes. */
  links?: Array<{ code: string; shortUrl: string; host: string; clicks?: number }>;
}

export interface CommunityComment {
  id: string;
  postId: string;
  author: CommunityAuthor;
  body: string;
  createdAt: string;
  likesCount: number;
  isLiked: boolean;
  parentId?: string; // Set when this comment is a reply to another comment ("comment pe comment")
  replyToAuthorName?: string;
  replies?: CommunityComment[]; // Nested replies thread
  repliesCount?: number;
  isOwn?: boolean;
  createdAtIso?: string;
  editedAt?: string | null;
  rawBody?: string;
  status?: CommunityPostStatus;
}

export interface PendingPostUpload {
  id: string;
  author: CommunityAuthor;
  body: string;
  hashtags: string[];
  attachments: CommunityAttachment[];
  progress: number; // 0 to 1
  status: 'uploading' | 'completed' | 'canceled';
  createdAt: string;
}
