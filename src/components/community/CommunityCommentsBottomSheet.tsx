import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useUser } from '@clerk/expo';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import { CommunityComment, CommunityPost } from '../../types/community';
import { addComment, deleteComment, toggleLikeComment } from '../../community/actions';
import { useCommunityComments } from '../../community/queries';
import { promptReport } from '../../community/reportPrompt';
import { NativeContentRenderer } from '../NativeContentRenderer';
import { baseMarkdownStyles } from '../../theme/markdownStyles';
import { CommunityCommentsSkeleton } from '../Skeletons';

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
    color: '#b23a2e',
    fontFamily: FONTS.mono,
    fontSize: 12,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
};

interface CommunityCommentsBottomSheetProps {
  visible: boolean;
  post: CommunityPost | null;
  onClose: () => void;
}

export const CommunityCommentsBottomSheet: React.FC<CommunityCommentsBottomSheetProps> = ({
  visible,
  post,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const keyboardSpace = useRef(new Animated.Value(0)).current;

  // Comments are a TanStack Query: cached per post, refetched when stale, updated in place by the actions.
  const commentsQuery = useCommunityComments(post?.id, visible);
  const comments = commentsQuery.data ?? [];
  const isLoading = commentsQuery.isPending;
  const [commentInput, setCommentInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    authorName: string;
  } | null>(null);
  const [collapsedThreads, setCollapsedThreads] = useState<Record<string, boolean>>({});
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Record<string, boolean>>({});
  const INITIAL_ROOT_LIMIT = 4;
  const [visibleRootCount, setVisibleRootCount] = useState(INITIAL_ROOT_LIMIT);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Sync comments for current post with smooth initial skeleton
  // Keyboard height listener
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

  if (!visible || !post) return null;

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
    setCollapsedThreads((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const toggleExpandReplies = (commentId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setExpandedReplyThreads((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const handleSendComment = () => {
    if (!commentInput.trim() || !post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    void addComment(
      post.id,
      commentInput.trim(),
      replyingTo?.commentId,
      replyingTo?.authorName
    );

    if (replyingTo?.commentId) {
      setExpandedReplyThreads((prev) => ({
        ...prev,
        [replyingTo.commentId]: true,
      }));
    }

    setCommentInput('');
    setReplyingTo(null);
    setVisibleRootCount((prev) => Math.max(prev, comments.length + 1));

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
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void toggleLikeComment(post.id, commentId);
  };

  const handleCommentOptions = (targetComment: CommunityComment) => {
    Haptics.selectionAsync().catch(() => {});
    const options: any[] = [
      {
        text: 'Copy text',
        onPress: async () => {
          await Clipboard.setStringAsync(targetComment.body);
          Alert.alert('Copied', 'Comment copied to clipboard');
        },
      },
    ];
    if (targetComment.isOwn) {
      options.push({
        text: 'Delete comment',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete comment?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void deleteComment(post!.id, targetComment.id) },
          ]),
      });
    } else {
      options.push({ text: 'Report comment', style: 'destructive', onPress: () => promptReport('comment', targetComment.id) });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Comment Options', undefined, options);
  };

  const getTotalCount = (list: CommunityComment[]): number => {
    return list.reduce((acc, c) => acc + 1 + (c.replies ? getTotalCount(c.replies) : 0), 0);
  };

  const totalComments = getTotalCount(comments);
  const visibleComments = comments.slice(0, visibleRootCount);
  const remainingCount = comments.length - visibleRootCount;

  const renderReplyItem = (reply: CommunityComment, rootCommentId: string) => {
    const initials = (reply.author.name[0] || 'U').toUpperCase();

    return (
      <View key={reply.id} style={styles.replyBlock}>
        {reply.author.avatarUrl ? (
          <Image source={{ uri: reply.author.avatarUrl }} style={styles.replyAvatar} />
        ) : (
          <View style={styles.replyAvatar}>
            <Text style={styles.replyAvatarText}>{initials}</Text>
          </View>
        )}

        <View style={styles.commentContent}>
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
            >
              <Feather name="more-vertical" size={14} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {reply.author.bio && (
            <Text style={styles.bioText} numberOfLines={1}>
              {reply.author.bio}
            </Text>
          )}

          <View style={styles.bodyWrap}>
            {reply.replyToAuthorName && (
              <Text style={styles.replyMentionText}>@{reply.replyToAuthorName} </Text>
            )}
            <NativeContentRenderer
              content={reply.body}
              variant="question"
              fontSize={13}
              markdownStyles={commentMarkdownStyles}
            />
          </View>

          <View style={styles.commentActionsRow}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleLikeComment(reply.id)}
              activeOpacity={0.7}
            >
              <Feather
                name="thumbs-up"
                size={13}
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
              <Feather name="message-square" size={13} color="#4b5563" />
              <Text style={styles.actionCountText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderRootComment = (comment: CommunityComment) => {
    const allReplies = flattenReplies(comment.replies || []);
    const isCollapsed = !!collapsedThreads[comment.id];
    const isRepliesExpanded = !!expandedReplyThreads[comment.id];
    const totalReplies = allReplies.length;

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
              • {comment.createdAt} • {totalReplies > 0 ? `${totalReplies} hidden` : 'collapsed'}
            </Text>
          </View>
          <Text style={styles.collapsedExpandBtn}>Expand</Text>
        </TouchableOpacity>
      );
    }

    const initials = (comment.author.name[0] || 'U').toUpperCase();

    return (
      <View key={comment.id} style={styles.commentBlock}>
        {comment.author.avatarUrl ? (
          <Image source={{ uri: comment.author.avatarUrl }} style={styles.commentAvatar} />
        ) : (
          <View style={styles.commentAvatar}>
            <Text style={styles.commentAvatarText}>{initials}</Text>
          </View>
        )}

        <View style={styles.commentContent}>
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
            >
              <Feather name="more-vertical" size={14} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {comment.author.bio && (
            <Text style={styles.bioText} numberOfLines={1}>
              {comment.author.bio}
            </Text>
          )}

          <View style={styles.bodyWrap}>
            <NativeContentRenderer
              content={comment.body}
              variant="question"
              fontSize={13.5}
              markdownStyles={commentMarkdownStyles}
            />
          </View>

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

          {totalReplies > 0 && isRepliesExpanded && (
            <View style={styles.repliesExpandedWrap}>
              <View style={styles.repliesThreadRow}>
                <TouchableOpacity
                  style={styles.threadLineTouchable}
                  onPress={() => toggleCollapseThread(comment.id)}
                  activeOpacity={0.6}
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Top Grab Handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handleBar} />
          </View>

          {/* Sheet Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              Comments ({totalComments})
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
            >
              <Feather name="x" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {/* Comments List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.commentsScrollView}
            contentContainerStyle={[
              styles.commentsScrollContent,
              !isLoading && comments.length === 0 && styles.commentsScrollContentEmpty,
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {isLoading ? (
              <CommunityCommentsSkeleton />
            ) : comments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="message-circle" size={32} color="#9ca3af" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No comments yet</Text>
                <Text style={styles.emptySubtitle}>
                  Be the first to share an answer, clarification, or insight!
                </Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {visibleComments.map((comment) => renderRootComment(comment))}

                {isLoadingMore && (
                  <View style={{ marginTop: 12 }}>
                    <CommunityCommentsSkeleton count={2} />
                  </View>
                )}

                {remainingCount > 0 && !isLoadingMore && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIsLoadingMore(true);
                      setTimeout(() => {
                        setVisibleRootCount((prev) => prev + 4);
                        setIsLoadingMore(false);
                      }, 350);
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather name="chevron-down" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.loadMoreText}>Load more comments</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>

          {/* Bottom Composer */}
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

          {Platform.OS === 'android' && <Animated.View style={{ height: keyboardSpace }} />}
        </View>
      </View>
    </Modal>
  );
};

const screenHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: screenHeight * 0.80,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sheetTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  commentsScrollView: {
    flex: 1,
  },
  commentsScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  commentsScrollContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    color: '#374151',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  commentsList: {
    gap: 16,
  },
  loadMoreBtn: {
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
  loadMoreText: {
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
  bioText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
  },
  bodyWrap: {
    marginTop: 4,
    marginBottom: 4,
  },
  replyMentionText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: '#2563eb',
  },
  commentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 3,
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  actionCountText: {
    fontFamily: FONTS.displayBold,
    fontSize: 11.5,
    color: '#4b5563',
  },
  actionLikedText: {
    color: COLORS.primary,
  },
  elbowConnectorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  elbowCurve: {
    width: 16,
    height: 12,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#cbd5e1',
    borderBottomLeftRadius: 8,
    marginLeft: 11.25,
    marginRight: 6,
  },
  seeRepliesBtn: {
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  seeRepliesText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    color: '#2563eb',
  },
  repliesExpandedWrap: {
    marginTop: 8,
  },
  repliesThreadRow: {
    flexDirection: 'row',
  },
  threadLineTouchable: {
    width: 24,
    alignSelf: 'stretch',
    position: 'relative',
  },
  continuousThreadLine: {
    width: 1.5,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 11.25,
    backgroundColor: '#cbd5e1',
  },
  nestedList: {
    flex: 1,
    gap: 12,
    paddingLeft: 4,
  },
  hideRepliesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  hideRepliesElbowCurve: {
    width: 16,
    height: 14,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#cbd5e1',
    borderBottomLeftRadius: 8,
    marginLeft: 11.25,
    marginRight: 6,
    marginTop: -8,
  },
  hideRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  hideRepliesText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11.5,
    color: '#6b7280',
  },
  collapsedBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f9fafb',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  collapsedLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collapsedAuthorName: {
    fontFamily: FONTS.displayBold,
    fontSize: 12.5,
    color: '#374151',
  },
  collapsedMeta: {
    fontFamily: FONTS.body,
    fontSize: 11.5,
    color: '#9ca3af',
    marginLeft: 4,
    flex: 1,
  },
  collapsedExpandBtn: {
    fontFamily: FONTS.displayBold,
    fontSize: 11.5,
    color: COLORS.primary,
    marginLeft: 8,
  },
  composerContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    marginBottom: 6,
  },
  replyBannerText: {
    fontFamily: FONTS.body,
    fontSize: 11.5,
    color: '#4b5563',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  composerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 40,
    maxHeight: 100,
  },
  composerInput: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13.5,
    color: '#111827',
    paddingVertical: 6,
    paddingRight: 8,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#f3f4f6',
  },
});
