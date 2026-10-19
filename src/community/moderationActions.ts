import { Alert } from 'react-native';
import { communityKeys } from '@pyqdeck/community-sdk';
import type { ReportGroup, ReportReason } from '@pyqdeck/community-sdk';
import { queryClient } from '../api/queryClient';
import { communityClient } from './client';
import { COMMUNITY_SLUG } from './config';
import { alertCommunityError } from './errors';
import { moderationKeys } from './moderationQueries';

// What a moderator can DO. Each action asks the server (which re-checks the role), then refreshes the lists on screen.
// They return true when it worked, so the screen can move on.

const SLUG = COMMUNITY_SLUG;

/** The reasons a moderator can give when removing something. Shown to the author, so the labels are plain. */
export const REMOVAL_REASONS: Array<{ key: ReportReason; label: string; hint: string }> = [
  { key: 'spam', label: 'Spam or misleading', hint: 'Ads, scams, repeated posts' },
  { key: 'harassment', label: 'Abusive or harassing', hint: 'Insults, bullying, threats' },
  { key: 'hate', label: 'Hateful', hint: 'Targets people for who they are' },
  { key: 'sexual', label: 'Sexual content', hint: 'Not allowed in the community' },
  { key: 'violence', label: 'Violent or graphic', hint: 'Gore, threats of harm' },
  { key: 'misinformation', label: 'Misinformation', hint: 'Wrong or harmful information' },
  { key: 'other', label: 'Something else', hint: 'Breaks the community rules' },
];

function refresh() {
  void queryClient.invalidateQueries({ queryKey: moderationKeys.all() });
  // What people see may have changed: feeds and posts are re-read the next time they are opened.
  void queryClient.invalidateQueries({ queryKey: communityKeys.feeds(SLUG), refetchType: 'none' });
  void queryClient.invalidateQueries({ queryKey: [...communityKeys.all(SLUG), 'post'], refetchType: 'none' });
  void queryClient.invalidateQueries({ queryKey: [...communityKeys.all(SLUG), 'comments'], refetchType: 'none' });
}

export async function moderatePost(
  postId: string,
  action: 'approve' | 'remove' | 'reject_edit',
  reason?: ReportReason
): Promise<boolean> {
  try {
    await communityClient.posts.moderate(postId, action, reason);
    refresh();
    return true;
  } catch (err) {
    alertCommunityError(err, 'Could not update this post');
    return false;
  }
}

export async function moderateComment(
  commentId: string,
  action: 'approve' | 'remove' | 'reject_edit',
  reason?: ReportReason
): Promise<boolean> {
  try {
    await communityClient.comments.moderate(commentId, action, reason);
    refresh();
    return true;
  } catch (err) {
    alertCommunityError(err, 'Could not update this comment');
    return false;
  }
}

/** Closes every open report on one thing. `remove` also takes the content down (or blocks the link). */
export async function resolveReports(
  group: Pick<ReportGroup, 'targetType' | 'targetId'>,
  outcome: 'actioned' | 'dismissed',
  remove = false
): Promise<boolean> {
  try {
    await communityClient.reports.resolve({ targetType: group.targetType, targetId: group.targetId, outcome, remove });
    refresh();
    return true;
  } catch (err) {
    alertCommunityError(err, 'Could not close these reports');
    return false;
  }
}

export async function suspendMember(username: string, reason: string): Promise<boolean> {
  try {
    await communityClient.members.suspend(username, reason);
    refresh();
    Alert.alert('Member suspended', `@${username} cannot post or comment until you lift the suspension.`);
    return true;
  } catch (err) {
    alertCommunityError(err, 'Could not suspend this member');
    return false;
  }
}
