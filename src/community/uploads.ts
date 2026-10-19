import { useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import { CommunityApiError, isAbortError, newIdempotencyKey } from '@pyqdeck/community-sdk';
import { queryClient } from '../api/queryClient';
import { registerWipeHook } from '../auth/wipeUserData';
import type {
  CommunityAttachment,
  CommunityAuthor,
  CommunityLinkedResource,
  CommunityPost,
  PendingPostUpload,
} from '../types/community';
import { communityKeys } from '@pyqdeck/community-sdk';
import { addPostToFeed } from './cache';
import { communityClient } from './client';
import { COMMUNITY_SLUG } from './config';
import { alertCommunityError } from './errors';
import { toCommunityPost } from './mappers';
import { prepareImage } from './prepareImages';

export interface PostPayload {
  author: CommunityAuthor;
  body: string;
  hashtags: string[];
  attachments: CommunityAttachment[];
  linkedResource?: CommunityLinkedResource;
}

// Posts being published right now. This is the one piece of community state that is genuinely local (a progress card
// with a cancel button), so it is a tiny store rather than a query.
let pending: PendingPostUpload[] = [];
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();
const emit = () => {
  pending = [...pending]; // new array identity so subscribers re-render
  listeners.forEach((l) => l());
};

registerWipeHook(() => {
  controllers.forEach((c) => c.abort());
  controllers.clear();
  pending = [];
  emit();
});

export const usePendingUploads = (): PendingPostUpload[] =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending
  );

/**
 * Publishes in the background with a progress card in the feed (images count for the first 90% of the progress).
 * A post the server holds for review is added with its pending status; a refused one shows the reason.
 */
export function startPostUpload(payload: PostPayload, onComplete?: (post: CommunityPost) => void): string {
  const id = `pending-${Date.now()}`;
  const controller = new AbortController();
  controllers.set(id, controller);
  pending = [
    {
      id,
      author: payload.author,
      body: payload.body,
      hashtags: payload.hashtags,
      attachments: payload.attachments,
      progress: 0,
      status: 'uploading',
      createdAt: 'Just now',
    },
    ...pending,
  ];
  emit();
  void run(id, payload, controller, onComplete);
  return id;
}

async function run(id: string, payload: PostPayload, controller: AbortController, onComplete?: (p: CommunityPost) => void) {
  try {
    const images = await Promise.all(
      payload.attachments.filter((a) => a.type === 'image').map((a) => prepareImage(a.url, a.name))
    );
    const post = await communityClient.publishPost({
      body: payload.body,
      images,
      linkedResource: payload.linkedResource,
      signal: controller.signal,
      idempotencyKey: newIdempotencyKey(),
      // Progress is written without a broadcast: the card re-renders when the upload starts or ends, not on every tick.
      onProgress: (p) => {
        const item = pending.find((x) => x.id === id);
        if (item) item.progress = p;
      },
    });
    pending = pending.filter((x) => x.id !== id);
    const mapped = toCommunityPost(post);
    addPostToFeed(mapped);
    void queryClient.invalidateQueries({ queryKey: communityKeys.me(COMMUNITY_SLUG) });
    emit();
    if (mapped.status === 'pending') {
      Alert.alert('Post under review', 'A moderator will check your post before it appears to others.');
    }
    onComplete?.(mapped);
  } catch (err) {
    pending = pending.filter((x) => x.id !== id);
    emit();
    if (isAbortError(err)) return;
    if (err instanceof CommunityApiError && err.isRefused) Alert.alert("This post can't be published", err.message);
    else alertCommunityError(err, 'Could not publish your post');
  } finally {
    controllers.delete(id);
  }
}

export function cancelPostUpload(id: string): boolean {
  controllers.get(id)?.abort();
  const existed = pending.some((p) => p.id === id);
  pending = pending.filter((p) => p.id !== id);
  if (existed) emit();
  return existed;
}
