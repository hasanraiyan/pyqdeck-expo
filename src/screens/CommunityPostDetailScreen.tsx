import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { CommunityComment, CommunityPost } from '../types/community';
import { communityStore } from '../data/mockCommunity';
import { CommunityPostCard } from '../components/community/CommunityPostCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { NativeContentRenderer } from '../components/NativeContentRenderer';
import { baseMarkdownStyles } from '../theme/markdownStyles';

const commentMarkdownStyles = {
  ...baseMarkdownStyles,
  body: {
    color: '#1f2937',
    fontSize: 13.5,
    lineHeight: 19.5,
    fontFamily: FONTS.body,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 4,
    color: '#1f2937',
    lineHeight: 19.5,
  },
  strong: {
    fontFamily: FONTS.bodyBold,
    color: '#111827',
  },
  em: {
    fontStyle: 'italic' as const,
    color: '#1f2937',
  },
  code_inline: {
    backgroundColor: '#f3f4f6',
    color: '#111827',
    fontFamily: FONTS.mono,
    fontSize: 12,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
};

export const CommunityPostDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const inputRef = useRef<TextInput>(null);
  const { postId, initialPost } = route.params || {};

  const [post, setPost] = useState<CommunityPost | undefined>(
    () => initialPost || communityStore.getPostById(postId)
  );
  const [comments, setComments] = useState<CommunityComment[]>(() =>
    communityStore.getComments(postId)
  );
  const [commentInput, setCommentInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    authorName: string;
  } | null>(null);
  const [collapsedThreads, setCollapsedThreads] = useState<Record<string, boolean>>({});
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = communityStore.subscribe(() => {
      if (postId) {
        setPost(communityStore.getPostById(postId));
        setComments(communityStore.getComments(postId));
      }
    });
    return unsub;
  }, [postId]);

  // Recursively collect all descendant replies in conversation order for 2-level flat rendering
  const flattenReplies = (repliesList: CommunityComment[]): CommunityComment[] => {
    const flat: CommunityComment[] = [];
    const walk = (list: CommunityComment[]) => {
      for (const item of list) {
        flat.push(item);
        if (item.replies && item.replies.length > 0) {
          walk(item.replies);
        }
      }
    };
    walk(repliesList);
    return flat;
  };

  const toggleCollapseThread = (commentId: string) => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedThreads((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const toggleExpandReplies = (commentId: string) => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedReplyThreads((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const handleSendComment = () => {
    if (!commentInput.trim() || !postId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    communityStore.addComment(
      postId,
      commentInput.trim(),
      replyingTo?.commentId,
      replyingTo?.authorName,
      'You (Student)',
      'B.Tech Student • PYQDeck'
    );

    // Auto-expand replies in the active thread so user sees their new response immediately
    if (replyingTo?.commentId) {
      setExpandedReplyThreads((prev) => ({
        ...prev,
        [replyingTo.commentId]: true,
      }));
    }

    setCommentInput('');
    setReplyingTo(null);
  };

  const handleStartReply = (commentId: string, authorName: string) => {
    Haptics.selectionAsync().catch(() => {});
    setReplyingTo({ commentId, authorName });
    inputRef.current?.focus();
  };

  const handleLikeComment = (commentId: string) => {
    if (!postId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    communityStore.toggleLikeComment(postId, commentId);
  };

  if (!post) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <Feather name="alert-circle" size={40} color={COLORS.textMuted} />
        <Text style={styles.notFoundText}>Post not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Count total comments including nested replies
  const getTotalCount = (list: CommunityComment[]): number => {
    return list.reduce((acc, c) => acc + 1 + (c.replies ? getTotalCount(c.replies) : 0), 0);
  };

  const totalComments = getTotalCount(comments);

  // Render a Level 1 reply item (always indented by standard 1 level with @mention)
  const renderReplyItem = (reply: CommunityComment, rootCommentId: string) => {
    const initials = (reply.author.name[0] || 'U').toUpperCase();

    return (
      <View key={reply.id} style={styles.replyBlock}>
        {/* Left Avatar (compact 26px for replies) */}
        <View style={styles.replyAvatar}>
          <Text style={styles.replyAvatarText}>{initials}</Text>
        </View>

        {/* Right Content */}
        <View style={styles.commentContent}>
          <View style={styles.bubble}>
            <View style={styles.bubbleHeader}>
              <Text style={styles.bubbleAuthorName} numberOfLines={1}>
                {reply.author.name}
              </Text>
              <Text style={styles.bubbleTime}>{reply.createdAt}</Text>
            </View>

            {reply.author.headline && (
              <Text style={styles.bubbleHeadline} numberOfLines={1}>
                {reply.author.headline}
              </Text>
            )}

            {reply.replyToAuthorName && (
              <Text style={styles.replyMention}>@{reply.replyToAuthorName} </Text>
            )}

            <NativeContentRenderer
              content={reply.body}
              variant="question"
              fontSize={13}
              markdownStyles={commentMarkdownStyles}
            />
          </View>

          {/* Action Row: Like, Reply */}
          <View style={styles.commentActionsRow}>
            <TouchableOpacity
              style={styles.actionInlineBtn}
              onPress={() => handleLikeComment(reply.id)}
            >
              <Text style={[styles.actionInlineText, reply.isLiked && styles.actionLikedText]}>
                Like {reply.likesCount > 0 ? `(${reply.likesCount})` : ''}
              </Text>
            </TouchableOpacity>

            <Text style={styles.actionDot}>•</Text>

            <TouchableOpacity
              style={styles.actionInlineBtn}
              onPress={() => handleStartReply(rootCommentId, reply.author.name)}
            >
              <Text style={styles.actionInlineText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Render top-level root comment with progressive disclosure and Reddit-style collapsing
  const renderRootComment = (comment: CommunityComment) => {
    const allReplies = flattenReplies(comment.replies || []);
    const isCollapsed = !!collapsedThreads[comment.id];
    const isRepliesExpanded = !!expandedReplyThreads[comment.id];
    const totalReplies = allReplies.length;

    // Reddit-style collapsed thread bar (single row)
    if (isCollapsed) {
      return (
        <TouchableOpacity
          key={comment.id}
          style={styles.collapsedBlock}
          onPress={() => toggleCollapseThread(comment.id)}
          activeOpacity={0.7}
        >
          <View style={styles.collapsedLeftRow}>
            <Feather name="chevron-right" size={14} color="#6b7280" style={{ marginRight: 6 }} />
            <Text style={styles.collapsedAuthorName}>{comment.author.name}</Text>
            <Text style={styles.collapsedMeta} numberOfLines={1}>
              • {comment.createdAt} • {totalReplies > 0 ? `${totalReplies} ${totalReplies === 1 ? 'reply' : 'replies'} hidden` : 'collapsed'}
            </Text>
          </View>
          <Text style={styles.collapsedExpandBtn}>Expand</Text>
        </TouchableOpacity>
      );
    }

    const initials = (comment.author.name[0] || 'U').toUpperCase();

    return (
      <View key={comment.id} style={styles.commentBlock}>
        {/* Left Avatar */}
        <View style={styles.commentAvatar}>
          <Text style={styles.commentAvatarText}>{initials}</Text>
        </View>

        {/* Right Content */}
        <View style={styles.commentContent}>
          {/* Gray LinkedIn-style Bubble */}
          <View style={styles.bubble}>
            <View style={styles.bubbleHeader}>
              <View style={styles.bubbleAuthorWrap}>
                <Text style={styles.bubbleAuthorName} numberOfLines={1}>
                  {comment.author.name}
                </Text>
              </View>
              <View style={styles.bubbleHeaderRight}>
                <Text style={styles.bubbleTime}>{comment.createdAt}</Text>
                <TouchableOpacity
                  style={styles.collapseThreadBtn}
                  onPress={() => toggleCollapseThread(comment.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Collapse thread"
                >
                  <Feather name="minus-circle" size={14} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>

            {comment.author.headline && (
              <Text style={styles.bubbleHeadline} numberOfLines={1}>
                {comment.author.headline}
              </Text>
            )}

            {comment.replyToAuthorName && (
              <Text style={styles.replyMention}>@{comment.replyToAuthorName} </Text>
            )}

            <NativeContentRenderer
              content={comment.body}
              variant="question"
              fontSize={13.5}
              markdownStyles={commentMarkdownStyles}
            />
          </View>

          {/* Action Row: Like, Reply */}
          <View style={styles.commentActionsRow}>
            <TouchableOpacity
              style={styles.actionInlineBtn}
              onPress={() => handleLikeComment(comment.id)}
            >
              <Text style={[styles.actionInlineText, comment.isLiked && styles.actionLikedText]}>
                Like {comment.likesCount > 0 ? `(${comment.likesCount})` : ''}
              </Text>
            </TouchableOpacity>

            <Text style={styles.actionDot}>•</Text>

            <TouchableOpacity
              style={styles.actionInlineBtn}
              onPress={() => handleStartReply(comment.id, comment.author.name)}
            >
              <Text style={styles.actionInlineText}>Reply</Text>
            </TouchableOpacity>

            {totalReplies > 0 && (
              <>
                <Text style={styles.actionDot}>•</Text>
                <TouchableOpacity
                  style={styles.actionInlineBtn}
                  onPress={() => toggleExpandReplies(comment.id)}
                >
                  <Text
                    style={[
                      styles.actionInlineText,
                      isRepliesExpanded && { color: COLORS.primary, fontFamily: FONTS.displayBold },
                    ]}
                  >
                    {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Level 0 Loaded First: Click to load/reveal replies */}
          {totalReplies > 0 && !isRepliesExpanded && (
            <TouchableOpacity
              style={styles.viewRepliesPillBtn}
              onPress={() => toggleExpandReplies(comment.id)}
              activeOpacity={0.7}
            >
              <Feather name="corner-down-right" size={13} color={COLORS.primary} style={{ marginRight: 2 }} />
              <Text style={styles.viewRepliesPillText}>
                View {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
              </Text>
              <Feather name="chevron-down" size={13} color={COLORS.primary} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          )}

          {/* Flattened Level 1 Replies Container (Strictly Max 2 Levels) */}
          {totalReplies > 0 && isRepliesExpanded && (
            <View style={styles.nestedContainer}>
              <TouchableOpacity
                style={styles.threadLineTouchable}
                onPress={() => toggleCollapseThread(comment.id)}
                activeOpacity={0.6}
                accessibilityLabel="Tap thread line to collapse"
              >
                <View style={styles.threadLine} />
              </TouchableOpacity>

              <View style={styles.nestedList}>
                {allReplies.map((reply) => renderReplyItem(reply, comment.id))}

                <TouchableOpacity
                  style={styles.hideRepliesBtn}
                  onPress={() => toggleExpandReplies(comment.id)}
                  activeOpacity={0.7}
                >
                  <Feather name="chevron-up" size={13} color="#6b7280" style={{ marginRight: 5 }} />
                  <Text style={styles.hideRepliesText}>Hide replies</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenContainer variant="read" gutter={false}>
          {/* Post item */}
          <CommunityPostCard
            post={post}
            initialExpanded={true}
            onLikePress={(id) => communityStore.toggleLikePost(id)}
            onBookmarkPress={(id) => communityStore.toggleBookmarkPost(id)}
            onHashtagPress={(tag) => {
              navigation.navigate('CommunityFeed', { filterHashtag: tag });
            }}
            onDismissPost={(id) => {
              communityStore.dismissPost(id);
              navigation.goBack();
            }}
          />

          {/* Comments section */}
          <View style={styles.commentsSection}>
            <View style={styles.commentsHeaderRow}>
              <Text style={styles.commentsCountLabel}>
                Comments ({totalComments})
              </Text>
            </View>

            {comments.length === 0 ? (
              <View style={styles.emptyCommentsCard}>
                <Feather name="message-circle" size={26} color="#9ca3af" style={{ marginBottom: 6 }} />
                <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
                <Text style={styles.emptyCommentsSubtitle}>
                  Be the first to share an answer, clarification, or insight!
                </Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {comments.map((comment) => renderRootComment(comment))}
              </View>
            )}
          </View>
        </ScreenContainer>
      </ScrollView>

      {/* Floating Comment Composer */}
      <View style={[styles.composerContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {replyingTo && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText}>
              Replying to <Text style={{ fontFamily: FONTS.displayBold }}>{replyingTo.authorName}</Text>
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.composerRow}>
          <TextInput
            ref={inputRef}
            style={styles.composerInput}
            placeholder={replyingTo ? `Reply to ${replyingTo.authorName}...` : "Add a comment..."}
            placeholderTextColor="#9ca3af"
            value={commentInput}
            onChangeText={setCommentInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !commentInput.trim() && styles.sendBtnDisabled]}
            onPress={handleSendComment}
            disabled={!commentInput.trim()}
          >
            <Feather name="send" size={16} color={commentInput.trim() ? '#ffffff' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  notFoundText: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    color: '#111827',
    marginTop: 12,
  },
  backBtn: {
    marginTop: 14,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  backBtnText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: COLORS.primary,
  },
  commentsSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  commentsHeaderRow: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 16,
  },
  commentsCountLabel: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: '#111827',
  },
  emptyCommentsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyCommentsTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  emptyCommentsSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: '#6b7280',
    textAlign: 'center',
  },
  commentsList: {
    gap: 16,
  },
  commentBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  replyBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondaryLight,
    borderWidth: 1,
    borderColor: 'rgba(31, 75, 67, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  commentAvatarText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: COLORS.secondary,
  },
  replyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  replyAvatarText: {
    fontFamily: FONTS.displayBold,
    fontSize: 10.5,
    color: COLORS.primary,
  },
  commentContent: {
    flex: 1,
  },
  bubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bubbleAuthorName: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#111827',
    flex: 1,
  },
  bubbleTime: {
    fontFamily: FONTS.body,
    fontSize: 10.5,
    color: '#6b7280',
    marginLeft: 8,
  },
  bubbleHeadline: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#4b5563',
    marginTop: 1,
    marginBottom: 4,
  },
  bubbleBody: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    color: '#1f2937',
    lineHeight: 19,
  },
  replyMention: {
    fontFamily: FONTS.displayBold,
    color: COLORS.primary,
  },
  commentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  actionInlineBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  actionInlineText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11.5,
    color: '#4b5563',
  },
  actionLikedText: {
    color: COLORS.primary,
    fontFamily: FONTS.displayBold,
  },
  actionDot: {
    fontSize: 10,
    color: '#9ca3af',
    marginHorizontal: 4,
  },
  repliesCountIndicator: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11.5,
    color: '#64748b',
  },
  collapsedBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  collapsedLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  collapsedAuthorName: {
    fontFamily: FONTS.displayBold,
    fontSize: 12.5,
    color: '#374151',
  },
  collapsedMeta: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 6,
    flex: 1,
  },
  collapsedExpandBtn: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: COLORS.primary,
  },
  bubbleAuthorWrap: {
    flex: 1,
  },
  bubbleHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  collapseThreadBtn: {
    padding: 2,
    marginLeft: 4,
  },
  nestedContainer: {
    position: 'relative',
    marginTop: 4,
    paddingLeft: 4,
  },
  threadLineTouchable: {
    position: 'absolute',
    left: -24,
    top: -6,
    bottom: 6,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadLine: {
    width: 2,
    height: '100%',
    backgroundColor: '#e2e8f0',
    borderRadius: 1,
  },
  nestedList: {
    gap: 8,
  },
  viewRepliesPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  viewRepliesPillText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: COLORS.primary,
  },
  hideRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  hideRepliesText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: '#6b7280',
  },
  composerContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    marginBottom: 6,
  },
  replyBannerText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.primary,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontFamily: FONTS.body,
    fontSize: 13.5,
    color: '#111827',
    maxHeight: 80,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
});
