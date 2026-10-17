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
  Alert,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useUser } from '@clerk/expo';
import { useHeaderHeight } from '@react-navigation/elements';

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
import { CommunityPostDetailSkeleton, CommunityCommentsSkeleton } from '../components/Skeletons';

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
  const { user } = useUser();
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const headerHeight = useHeaderHeight();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const keyboardSpace = useRef(new Animated.Value(0)).current;
  const { postId, initialPost, focusComments } = route.params || {};

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
  const INITIAL_ROOT_COMMENTS_LIMIT = 4;
  const [visibleRootCommentsCount, setVisibleRootCommentsCount] = useState(INITIAL_ROOT_COMMENTS_LIMIT);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const commentsSectionYRef = useRef<number>(0);

  // Auto-focus comment composer & scroll down if opened via comment button on feed
  useEffect(() => {
    if (focusComments) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        if (commentsSectionYRef.current > 0) {
          scrollViewRef.current?.scrollTo({ y: commentsSectionYRef.current, animated: true });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [focusComments]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      Animated.timing(keyboardSpace, {
        toValue: e.endCoordinates.height,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      Animated.timing(keyboardSpace, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

    const authorName = user?.fullName || user?.firstName || 'You (Student)';
    const authorHeadline = user?.primaryEmailAddress?.emailAddress
      ? 'Student • PYQDeck'
      : 'B.Tech Student • PYQDeck';

    communityStore.addComment(
      postId,
      commentInput.trim(),
      replyingTo?.commentId,
      replyingTo?.authorName,
      authorName,
      authorHeadline
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
    setVisibleRootCommentsCount((prev) => Math.max(prev, comments.length + 1));

    // Smoothly scroll down so the user sees their newly posted comment immediately
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  const handleStartReply = (commentId: string, authorName: string) => {
    Haptics.selectionAsync().catch(() => {});
    setReplyingTo({ commentId, authorName });
    setExpandedReplyThreads((prev) => ({
      ...prev,
      [commentId]: true,
    }));
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleLikeComment = (commentId: string) => {
    if (!postId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    communityStore.toggleLikeComment(postId, commentId);
  };

  const handleCommentOptions = (targetComment: CommunityComment) => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert('Comment Options', undefined, [
      {
        text: 'Copy text',
        onPress: async () => {
          await Clipboard.setStringAsync(targetComment.body);
          Alert.alert('Copied', 'Comment copied to clipboard');
        },
      },
      {
        text: 'Report comment',
        style: 'destructive',
        onPress: () => Alert.alert('Reported', 'Thank you for reporting. Our team will review this comment.'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const [isLoading, setIsLoading] = useState(!initialPost && !post);

  useEffect(() => {
    if (!post && postId) {
      const timer = setTimeout(() => {
        setPost(communityStore.getPostById(postId));
        setComments(communityStore.getComments(postId));
        setIsLoading(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [postId, post]);

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: 10 }]}>
        <ScreenContainer variant="read" gutter={false}>
          <CommunityPostDetailSkeleton />
        </ScreenContainer>
      </View>
    );
  }

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
  const visibleComments = comments.slice(0, visibleRootCommentsCount);
  const remainingCommentsCount = comments.length - visibleRootCommentsCount;

  // Render a Level 1 reply item (indented beside vertical threadline, with bold blue mention)
  const renderReplyItem = (reply: CommunityComment, rootCommentId: string) => {
    const initials = (reply.author.name[0] || 'U').toUpperCase();

    return (
      <View key={reply.id} style={styles.replyBlock}>
        {/* Left Avatar (30px) */}
        {reply.author.avatarUrl ? (
          <Image source={{ uri: reply.author.avatarUrl }} style={styles.replyAvatar} />
        ) : (
          <View style={styles.replyAvatar}>
            <Text style={styles.replyAvatarText}>{initials}</Text>
          </View>
        )}

        {/* Right Content */}
        <View style={styles.commentContent}>
          {/* Header Row: Name, time, 3-dots */}
          <View style={styles.authorHeaderRow}>
            <View style={styles.authorMetaLeft}>
              <Text style={styles.authorName} numberOfLines={1}>
                {reply.author.name}
              </Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.timeText}>{reply.createdAt}</Text>
            </View>
            <TouchableOpacity
              style={styles.moreOptionsBtn}
              onPress={() => handleCommentOptions(reply)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Reply options"
            >
              <Feather name="more-vertical" size={14} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Headline / Role Subtitle */}
          {reply.author.headline && (
            <Text style={styles.headlineText} numberOfLines={1}>
              {reply.author.headline}
            </Text>
          )}

          {/* Body: blue bold mention tag + text */}
          <View style={styles.bodyWrap}>
            {reply.replyToAuthorName && (
              <Text style={styles.replyMentionHighlight}>
                {reply.replyToAuthorName}{' '}
                <Text style={styles.replyMentionHyphen}>— </Text>
              </Text>
            )}
            <NativeContentRenderer
              content={reply.body}
              variant="question"
              fontSize={13.5}
              markdownStyles={commentMarkdownStyles}
            />
          </View>

          {/* Action Row: 👍 count, 💬 Reply */}
          <View style={styles.commentActionsRow}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleLikeComment(reply.id)}
              activeOpacity={0.7}
            >
              <Feather
                name="thumbs-up"
                size={13.5}
                color={reply.isLiked ? COLORS.primary : '#4b5563'}
              />
              {reply.likesCount > 0 && (
                <Text style={[styles.actionCountText, reply.isLiked && styles.actionLikedText]}>
                  {reply.likesCount}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleStartReply(rootCommentId, reply.author.name)}
              activeOpacity={0.7}
            >
              <Feather name="message-square" size={13.5} color="#4b5563" />
              <Text style={styles.actionCountText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Render top-level root comment with progressive disclosure (Level 0 loaded first)
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
        {/* Left Avatar (36px) */}
        {comment.author.avatarUrl ? (
          <Image source={{ uri: comment.author.avatarUrl }} style={styles.commentAvatar} />
        ) : (
          <View style={styles.commentAvatar}>
            <Text style={styles.commentAvatarText}>{initials}</Text>
          </View>
        )}

        {/* Right Content */}
        <View style={styles.commentContent}>
          {/* Header Row: Name, time, 3-dots */}
          <View style={styles.authorHeaderRow}>
            <View style={styles.authorMetaLeft}>
              <Text style={styles.authorName} numberOfLines={1}>
                {comment.author.name}
              </Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.timeText}>{comment.createdAt}</Text>
            </View>
            <TouchableOpacity
              style={styles.moreOptionsBtn}
              onPress={() => handleCommentOptions(comment)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Comment options"
            >
              <Feather name="more-vertical" size={14} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Headline / Role Subtitle */}
          {comment.author.headline && (
            <Text style={styles.headlineText} numberOfLines={1}>
              {comment.author.headline}
            </Text>
          )}

          {/* Body: open typography (no bubble background) */}
          <View style={styles.bodyWrap}>
            <NativeContentRenderer
              content={comment.body}
              variant="question"
              fontSize={13.5}
              markdownStyles={commentMarkdownStyles}
            />
          </View>

          {/* Action Row: 👍 count, 💬 Reply */}
          <View style={styles.commentActionsRow}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleLikeComment(comment.id)}
              activeOpacity={0.7}
            >
              <Feather
                name="thumbs-up"
                size={13.5}
                color={comment.isLiked ? COLORS.primary : '#4b5563'}
              />
              {comment.likesCount > 0 && (
                <Text style={[styles.actionCountText, comment.isLiked && styles.actionLikedText]}>
                  {comment.likesCount}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleStartReply(comment.id, comment.author.name)}
              activeOpacity={0.7}
            >
              <Feather name="message-square" size={13.5} color="#4b5563" />
              <Text style={styles.actionCountText}>Reply</Text>
            </TouchableOpacity>
          </View>

          {/* Level 0 Loaded First: Curved elbow connector curving into "See N more replies" */}
          {totalReplies > 0 && !isRepliesExpanded && (
            <View style={styles.elbowConnectorWrap}>
              <View style={styles.elbowCurve} />
              <TouchableOpacity
                style={styles.seeRepliesBtn}
                onPress={() => toggleExpandReplies(comment.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.seeRepliesText}>
                  See {totalReplies} {totalReplies === 1 ? 'reply' : 'more replies'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Flattened Level 1 Replies Container (Strictly Max 2 Levels) */}
          {totalReplies > 0 && isRepliesExpanded && (
            <View style={styles.repliesExpandedWrap}>
              <View style={styles.repliesThreadRow}>
                <TouchableOpacity
                  style={styles.threadLineTouchable}
                  onPress={() => toggleCollapseThread(comment.id)}
                  activeOpacity={0.6}
                  accessibilityLabel="Tap thread line to collapse"
                >
                  <View style={styles.continuousThreadLine} />
                </TouchableOpacity>

                <View style={styles.nestedList}>
                  {allReplies.map((reply) => renderReplyItem(reply, comment.id))}
                </View>
              </View>

              <View style={styles.hideRepliesRow}>
                <View style={styles.hideRepliesElbowCurve} />
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <ScreenContainer variant="read" gutter={false}>
          {/* Post item */}
          <CommunityPostCard
            post={post}
            initialExpanded={true}
            showDismissAction={false}
            onLikePress={(id) => communityStore.toggleLikePost(id)}
            onBookmarkPress={(id) => communityStore.toggleBookmarkPost(id)}
            onHashtagPress={(tag) => {
              navigation.navigate('CommunityFeed', { filterHashtag: tag });
            }}
          />

          {/* Comments section */}
          <View
            style={styles.commentsSection}
            onLayout={(e) => {
              commentsSectionYRef.current = e.nativeEvent.layout.y;
            }}
          >
            {/* Comments Header */}
            <View style={styles.commentsHeaderRow}>
              <Text style={styles.commentsHeaderTitle}>
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
                {visibleComments.map((comment) => renderRootComment(comment))}

                {isLoadingMoreComments && (
                  <View style={{ marginTop: 12 }}>
                    <CommunityCommentsSkeleton count={2} />
                  </View>
                )}

                {remainingCommentsCount > 0 && !isLoadingMoreComments && (
                  <TouchableOpacity
                    style={styles.loadMoreCommentsBtn}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIsLoadingMoreComments(true);
                      setTimeout(() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setVisibleRootCommentsCount((prev) => prev + 4);
                        setIsLoadingMoreComments(false);
                      }, 350);
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather name="chevron-down" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.loadMoreCommentsText}>
                      Load more comments
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScreenContainer>
      </ScrollView>

      {/* Floating Comment Composer (LinkedIn style with user avatar + selector) */}
      <View
        style={[
          styles.composerContainer,
          {
            paddingBottom: isKeyboardVisible
              ? Platform.OS === 'android' ? 24 : 10
              : Math.max(insets.bottom, 10),
          },
        ]}
      >
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
          {/* Rounded Pill Composer */}
          <View style={styles.composerPill}>
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
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather name="send" size={14} color={commentInput.trim() ? '#ffffff' : '#9ca3af'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Android is edge-to-edge: the window never resizes, so lift the composer by the real
          IME height (includes the suggestion strip), animated. iOS uses KeyboardAvoidingView. */}
      {Platform.OS === 'android' && <Animated.View style={{ height: keyboardSpace }} />}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    borderBottomColor: '#f1f5f9',
    marginBottom: 16,
  },
  commentsHeaderTitle: {
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
  loadMoreCommentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    alignSelf: 'center',
  },
  loadMoreCommentsText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12.5,
    color: COLORS.primary,
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
  authorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  authorName: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#111827',
  },
  metaDot: {
    fontSize: 11,
    color: '#9ca3af',
    marginHorizontal: 5,
  },
  timeText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#6b7280',
  },
  moreOptionsBtn: {
    padding: 2,
    marginLeft: 4,
  },
  headlineText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    marginBottom: 4,
  },
  bodyWrap: {
    marginTop: 2,
    marginBottom: 4,
  },
  replyMentionHighlight: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#0a66c2',
  },
  replyMentionHyphen: {
    color: '#64748b',
    fontFamily: FONTS.body,
  },
  commentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 2,
    marginBottom: 6,
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  actionCountText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: '#4b5563',
  },
  actionLikedText: {
    color: COLORS.primary,
    fontFamily: FONTS.displayBold,
  },
  elbowConnectorWrap: {
    position: 'relative',
    marginTop: 4,
    marginBottom: 2,
    paddingLeft: 4,
  },
  elbowCurve: {
    position: 'absolute',
    left: -28,
    top: -12,
    width: 24,
    height: 24,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#cbd5e1',
    borderBottomLeftRadius: 10,
  },
  seeRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  seeRepliesText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: '#111827',
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
  repliesExpandedWrap: {
    position: 'relative',
    marginTop: 4,
    paddingLeft: 4,
  },
  repliesThreadRow: {
    position: 'relative',
  },
  threadLineTouchable: {
    position: 'absolute',
    left: -28,
    top: -10,
    bottom: 0,
    width: 24,
  },
  continuousThreadLine: {
    width: 1.5,
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#cbd5e1',
    borderRadius: 1,
  },
  nestedList: {
    gap: 8,
  },
  hideRepliesRow: {
    position: 'relative',
    marginTop: 6,
  },
  hideRepliesElbowCurve: {
    position: 'absolute',
    left: -28,
    top: -12,
    width: 24,
    height: 24,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#cbd5e1',
    borderBottomLeftRadius: 10,
  },
  hideRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
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
    paddingHorizontal: 14,
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
    gap: 8,
  },
  composerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingLeft: 14,
    paddingRight: 4,
    paddingBottom: 3,
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  composerInput: {
    flex: 1,
    paddingVertical: 0,
    paddingTop: 7,
    paddingBottom: 7,
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: '#111827',
    // 3 lines (3 * 19) + vertical padding (14)
    maxHeight: 71,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sendBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
});
