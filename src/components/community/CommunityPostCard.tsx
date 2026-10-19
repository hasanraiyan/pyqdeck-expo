import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Platform,
  Alert,
  Modal,
  Linking,
  LayoutAnimation,
  UIManager,
} from 'react-native';

import { enableLayoutAnimation } from '../../utils/layoutAnimation';

enableLayoutAnimation();
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { CommunityPost } from '../../types/community';
import { deletePost } from '../../community/actions';
import { promptReport } from '../../community/reportPrompt';
import { useRequireAuth } from '../../auth/useRequireAuth';
import { EditPostModal } from './EditPostModal';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import { CommunityDocumentSlide } from './CommunityDocumentSlide';
import { CommunityMediaViewerModal } from './CommunityMediaViewerModal';
import { CommunityMultiImageCarousel } from './CommunityMultiImageCarousel';
import { NativeContentRenderer } from '../NativeContentRenderer';
import { useImageDimensions } from '../../utils/useImageDimensions';
import { baseMarkdownStyles, markdownRules } from '../../theme/markdownStyles';

interface CommunityPostCardProps {
  post: CommunityPost;
  onLikePress: (postId: string) => void;
  onBookmarkPress: (postId: string) => void;
  onHashtagPress?: (hashtag: string) => void;
  onCommentPress?: (post: CommunityPost) => void;
  onOpenDetail?: (post: CommunityPost) => void;
  onDismissPost?: (postId: string) => void;
  initialExpanded?: boolean;
  showDismissAction?: boolean;
}

import {
  formatHashtagsForMarkdown,
  truncateMarkdownSafely,
} from '../../utils/communityFormatters';

export { formatHashtagsForMarkdown, truncateMarkdownSafely };

const postMarkdownStyles = {
  ...baseMarkdownStyles,
  body: {
    color: '#1f2937',
    fontSize: 14.5,
    lineHeight: 22,
    fontFamily: FONTS.body,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 6,
    color: '#1f2937',
    lineHeight: 22,
  },
  strong: {
    fontFamily: FONTS.bodyBold,
    color: '#111827',
  },
  em: {
    fontStyle: 'italic' as const,
    color: '#1f2937',
  },
  link: {
    color: '#0a66c2',
    fontFamily: FONTS.bodySemi,
    textDecorationLine: 'none' as const,
  },
  code_inline: {
    backgroundColor: '#f3f4f6',
    color: '#111827',
    fontFamily: FONTS.mono,
    fontSize: 12.5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
  },
};

const CommunitySingleImage: React.FC<{
  src: string;
  onPress: () => void;
}> = ({ src, onPress }) => {
  const { aspect } = useImageDimensions(src);

  // Dynamic aspect ratio bounded between 0.75 (portrait 3:4) and 1.91 (landscape 16:9)
  // Defaults to 1.33 (4:3) until measured
  const clampedAspect = aspect ? Math.max(0.75, Math.min(aspect, 1.91)) : 1.33;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[
        styles.singleImageWrap,
        {
          aspectRatio: clampedAspect,
          maxHeight: 460,
          minHeight: 180,
        },
      ]}
      onPress={onPress}
    >
      <Image
        source={{ uri: src }}
        style={styles.singleImage}
        contentFit="cover"
        transition={200}
      />
    </TouchableOpacity>
  );
};

export const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
  post,
  onLikePress,
  onBookmarkPress,
  onHashtagPress,
  onCommentPress,
  onOpenDetail,
  onDismissPost,
  initialExpanded = false,
  showDismissAction = true,
}) => {
  const navigation = useNavigation<any>();
  const { guard } = useRequireAuth();
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [mediaType, setMediaType] = useState<'document' | 'image'>('image');
  const [expandedText, setExpandedText] = useState(initialExpanded);
  const [collapsedLimit, setCollapsedLimit] = useState(200);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const fitRef = useRef(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  useEffect(() => {
    fitRef.current = false;
    setCollapsedLimit(200);
    setNeedsTruncation(false);
  }, [post.id]);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const images = post.attachments
    .filter((a) => a.type === 'image')
    .map((a) => ({ src: a.url, alt: a.name || post.body.slice(0, 50) }));

  const pdfAttachment = post.attachments.find((a) => a.type === 'pdf');

  const handleOpenImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedMediaIndex(index);
    setMediaType('image');
    setMediaViewerVisible(true);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const shareUrl = `https://pyqdeck.in/community/${post.slug}`;
    const shareMessage = `Check out this post on PYQDeck Community:\n"${post.body.slice(0, 100)}..."\n\n${shareUrl}`;

    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(shareUrl);
        Alert.alert('Link Copied', 'Post link copied to clipboard!');
      } else {
        await Share.share({
          message: shareMessage,
          url: shareUrl,
          title: 'PYQDeck Community Post',
        });
      }
    } catch {
      // User dismissed share
    }
  };

  const cleanTime = (post.createdAt || '').replace(/[•·]?\s*🌐/g, '').trim();

  const handleDiscard = () => guard(doDiscard, 'react');

  const doDiscard = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsDismissing(true);

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    dismissTimerRef.current = setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onDismissPost?.(post.id);
    }, 4000);
  };

  const handleUndoDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsDismissing(false);
  };

  // Custom markdown rules: intercept hashtag links and see-more inline link
  const postMarkdownRules = useMemo(
    () => ({
      ...markdownRules,
      link: (node: any, children: any, parent: any, styles: any) => {
        const href = node.attributes?.href || '';
        if (href === 'action:see_more') {
          return (
            <Text
              key={node.key}
              style={styles.seeMoreInlineText}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setExpandedText(true);
              }}
            >
              {' '}see more
            </Text>
          );
        }
        return (
          <Text
            key={node.key}
            style={[
              styles.link,
              {
                color: '#0a66c2',
                fontFamily: FONTS.bodySemi,
                textDecorationLine: 'none',
              },
            ]}
            onPress={() => {
              if (href.startsWith('hashtag:')) {
                const tag = href.slice(8);
                Haptics.selectionAsync().catch(() => {});
                onHashtagPress?.(tag);
              } else {
                Linking.openURL(href).catch(() => {});
              }
            }}
          >
            {children}
          </Text>
        );
      },
    }),
    [onHashtagPress]
  );

  const truncatedNow = needsTruncation;

  const displayContent = useMemo(() => {
    if (truncatedNow && !expandedText) {
      const truncated = truncateMarkdownSafely(post.body, collapsedLimit);
      return `${formatHashtagsForMarkdown(truncated)}... [see more](action:see_more)`;
    }
    return formatHashtagsForMarkdown(post.body);
  }, [post.body, truncatedNow, expandedText, collapsedLimit]);

  const bodyOnLayout = (e: any) => {
    if (expandedText || fitRef.current) return;
    const h = e?.nativeEvent?.layout?.height ?? 0;
    if (h > 3 * 22 + 8 + 4 && collapsedLimit > 40) {
      setNeedsTruncation(true);
      setCollapsedLimit((prev) => Math.max(40, prev - 20));
    } else if (h <= 3 * 22 + 8 + 4) {
      fitRef.current = true;
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || '?').toUpperCase();
  };

  if (isDismissing) {
    return (
      <View style={styles.dismissedCard}>
        <View style={styles.dismissedLeft}>
          <View style={styles.dismissedIconWrap}>
            <Feather name="check" size={14} color={COLORS.primary} />
          </View>
          <View style={styles.dismissedTextContainer}>
            <Text style={styles.dismissedText}>Post removed</Text>
            <Text style={styles.dismissedSubtext}>Hidden from your feed</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.undoBtn}
          onPress={handleUndoDismiss}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
        >
          <Text style={styles.undoBtnText}>Undo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cardContainer}>
      {/* Clean Post Header: Profile Name + Time, 3-Dot Options & Discard Cross */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.authorSection}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            navigation.navigate('UserProfile', {
              userId: post.isOwnPost ? 'me' : post.author.id,
              author: post.author,
            });
          }}
        >
          {post.author.avatarUrl ? (
            <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarMonogram}>
              <Text style={styles.avatarMonogramText}>{getInitials(post.author.name)}</Text>
            </View>
          )}
          <View style={styles.authorMeta}>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorName} numberOfLines={1}>
                {post.author.name}
              </Text>
              <Text style={styles.timeDot}>•</Text>
              <Text style={styles.timeText}>{cleanTime}</Text>
            </View>
            {post.author.bio ? (
              <Text style={styles.authorBio} numberOfLines={1} ellipsizeMode="tail">
                {post.author.bio}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setOptionsModalVisible(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={styles.headerActionBtn}
            accessibilityRole="button"
            accessibilityLabel="Post options"
          >
            <Feather name="more-vertical" size={18} color={COLORS.textSubtle} />
          </TouchableOpacity>

          {showDismissAction && (
            <TouchableOpacity
              onPress={handleDiscard}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={styles.headerActionBtn}
              accessibilityRole="button"
              accessibilityLabel="Discard post"
            >
              <Feather name="x" size={18} color={COLORS.textSubtle} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {post.isOwnPost && post.status !== 'published' ? (
        <View style={{ backgroundColor: post.status === 'rejected' ? '#fee2e2' : '#fef3c7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 }}>
          <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 12, color: post.status === 'rejected' ? '#991b1b' : '#92400e' }}>
            {post.status === 'rejected'
              ? `Removed by a moderator${post.removedReason ? ` (${post.removedReason})` : ''}. Only you can see this.`
              : post.heldReason === 'reports'
                ? 'Hidden while moderators review reports. Only you can see this.'
                : 'Under review. It will appear to others once a moderator approves it.'}
          </Text>
        </View>
      ) : null}
      {post.isOwnPost && post.hasPendingEdit ? (
        <View style={{ backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 }}>
          <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 12, color: '#92400e' }}>
            Your edit is under review. Others still see the previous version.
          </Text>
        </View>
      ) : null}

      {/* Main Post Body (Full Markdown & LaTeX Support with Inline See More) */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onOpenDetail?.(post)}
        style={styles.bodyTouchable}
        onLayout={bodyOnLayout}
      >
        <NativeContentRenderer
          content={displayContent}
          variant="question"
          fontSize={14.5}
          markdownStyles={postMarkdownStyles}
          rules={postMarkdownRules}
        />
      </TouchableOpacity>



      {/* PDF Document Slide Carousel (LinkedIn style) */}
      {pdfAttachment && (
        <CommunityDocumentSlide
          attachment={pdfAttachment}
          onOpenFullscreen={(pageIndex) => {
            setSelectedMediaIndex(pageIndex);
            setMediaType('document');
            setMediaViewerVisible(true);
          }}
        />
      )}

      {/* Images presentation */}
      {images.length > 0 && (
        <View style={styles.mediaContainer}>
          {images.length === 1 ? (
            <CommunitySingleImage
              src={images[0].src}
              onPress={() => handleOpenImage(0)}
            />
          ) : (
            <CommunityMultiImageCarousel
              images={images}
              onOpenImage={handleOpenImage}
            />
          )}
        </View>
      )}

      {/* Merged Single-Line Action Bar (Icon + Number, 0 is hidden) */}
      <View style={styles.singleActionsBar}>
        {/* Like */}
        <TouchableOpacity
          style={styles.actionTab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            guard(() => onLikePress(post.id), 'react');
          }}
          activeOpacity={0.7}
          accessibilityLabel={`Like, ${post.likesCount} likes`}
        >
          <Feather
            name="thumbs-up"
            size={18}
            color={post.isLiked ? COLORS.primary : COLORS.textMuted}
          />
          {post.likesCount > 0 && (
            <Text
              style={[
                styles.actionCountText,
                post.isLiked && { color: COLORS.primary, fontFamily: FONTS.displayBold },
              ]}
            >
              {post.likesCount}
            </Text>
          )}
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity
          style={styles.actionTab}
          onPress={() => onCommentPress?.(post)}
          activeOpacity={0.7}
          accessibilityLabel={`Comments, ${post.commentsCount} comments`}
        >
          <Feather name="message-square" size={18} color={COLORS.textMuted} />
          {post.commentsCount > 0 && (
            <Text style={styles.actionCountText}>
              {post.commentsCount}
            </Text>
          )}
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={styles.actionTab}
          onPress={handleShare}
          activeOpacity={0.7}
          accessibilityLabel="Share post"
        >
          <Feather name="share-2" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Bookmark / Save */}
        <TouchableOpacity
          style={styles.actionTab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            guard(() => onBookmarkPress(post.id), 'react');
          }}
          activeOpacity={0.7}
          accessibilityLabel="Save post"
        >
          <Feather
            name="bookmark"
            size={18}
            color={post.isBookmarked ? COLORS.secondary : COLORS.textMuted}
          />
          {post.bookmarksCount > 0 && (
            <Text
              style={[
                styles.actionCountText,
                post.isBookmarked && { color: COLORS.secondary, fontFamily: FONTS.displayBold },
              ]}
            >
              {post.bookmarksCount}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Community Fullscreen Media & Document Viewer (LinkedIn style) */}
      <CommunityMediaViewerModal
        visible={mediaViewerVisible}
        post={post}
        initialIndex={selectedMediaIndex}
        initialType={mediaType}
        onClose={() => setMediaViewerVisible(false)}
        onLikePress={(id) => guard(() => onLikePress(id), 'react')}
        onCommentPress={onCommentPress}
        onSharePress={handleShare}
        onOpenDetail={
          onOpenDetail ||
          ((targetPost) => {
            navigation.navigate('CommunityPostDetail', {
              postId: targetPost.id,
              initialPost: targetPost,
            });
          })
        }
      />

      {/* 3-Dot Options Bottom Sheet Modal */}
      <Modal
        visible={optionsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View
            style={styles.optionsSheet}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetHandle} />

            {/* Save / Unsave Post */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setOptionsModalVisible(false);
                guard(() => onBookmarkPress(post.id), 'react');
              }}
            >
              <View style={styles.optionIconWrap}>
                <Feather
                  name="bookmark"
                  size={18}
                  color={post.isBookmarked ? COLORS.primary : '#374151'}
                />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionLabel}>
                  {post.isBookmarked ? 'Saved to bookmarks' : 'Save post'}
                </Text>
                <Text style={styles.optionSubtitle}>
                  {post.isBookmarked ? 'Tap to remove from saved' : 'Save for later reference'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Copy link */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={async () => {
                Haptics.selectionAsync().catch(() => {});
                setOptionsModalVisible(false);
                const shareUrl = `https://pyqdeck.in/community/${post.slug}`;
                try {
                  await Clipboard.setStringAsync(shareUrl);
                  Alert.alert('Link Copied', 'Post link copied to clipboard!');
                } catch {
                  // Ignore
                }
              }}
            >
              <View style={styles.optionIconWrap}>
                <Feather name="link" size={18} color="#374151" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionLabel}>Copy link to post</Text>
                <Text style={styles.optionSubtitle}>Share or open link outside the app</Text>
              </View>
            </TouchableOpacity>

            {/* Share via native share dialog */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setOptionsModalVisible(false);
                handleShare();
              }}
            >
              <View style={styles.optionIconWrap}>
                <Feather name="share-2" size={18} color="#374151" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionLabel}>Share post</Text>
                <Text style={styles.optionSubtitle}>Send via WhatsApp, Telegram, etc.</Text>
              </View>
            </TouchableOpacity>

            {/* Discard / Hide post */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setOptionsModalVisible(false);
                handleDiscard();
              }}
            >
              <View style={styles.optionIconWrap}>
                <Feather name="eye-off" size={18} color="#374151" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionLabel}>Hide this post</Text>
                <Text style={styles.optionSubtitle}>Discard this post from your feed</Text>
              </View>
            </TouchableOpacity>

            {post.isOwnPost ? (
              <>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setOptionsModalVisible(false);
                    setEditVisible(true);
                  }}
                >
                  <View style={styles.optionIconWrap}>
                    <Feather name="edit-2" size={18} color="#374151" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionLabel}>Edit post</Text>
                    <Text style={styles.optionSubtitle}>Change the text of your post</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsModalVisible(false);
                    Alert.alert('Delete post?', 'It disappears for everyone right away. This cannot be undone.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => void deletePost(post.id) },
                    ]);
                  }}
                >
                  <View style={[styles.optionIconWrap, { backgroundColor: '#fee2e2' }]}>
                    <Feather name="trash-2" size={18} color="#dc2626" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionLabel, { color: '#dc2626' }]}>Delete post</Text>
                    <Text style={styles.optionSubtitle}>Remove it from the community</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
            /* Report post */
            <TouchableOpacity
              style={[styles.optionItem, { borderBottomWidth: 0 }]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setOptionsModalVisible(false);
                guard(() => promptReport('post', post.id), 'flag');
              }}
            >
              <View style={[styles.optionIconWrap, { backgroundColor: '#fee2e2' }]}>
                <Feather name="flag" size={18} color="#dc2626" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionLabel, { color: '#dc2626' }]}>Report post</Text>
                <Text style={styles.optionSubtitle}>Inappropriate, spam, or misleading content</Text>
              </View>
            </TouchableOpacity>
            )}

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setOptionsModalVisible(false)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {post.isOwnPost ? <EditPostModal post={post} visible={editVisible} onClose={() => setEditVisible(false)} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  dismissedCard: {
    backgroundColor: 'transparent',
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dismissedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dismissedIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(31, 75, 67, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissedTextContainer: {
    flex: 1,
  },
  dismissedText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: '#1f2937',
  },
  dismissedSubtext: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
  },
  undoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(31, 75, 67, 0.25)',
  },
  undoBtnText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12.5,
    color: COLORS.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  avatarMonogram: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMonogramText: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: '#1d4ed8',
  },
  authorMeta: {
    marginLeft: 11,
    flex: 1,
    justifyContent: 'center',
    paddingTop: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: '#111827',
    flexShrink: 1,
    lineHeight: 18,
  },
  timeDot: {
    fontSize: 11,
    color: '#9ca3af',
  },
  timeText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
  authorBio: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  headerActionBtn: {
    padding: 6,
    borderRadius: RADIUS.full,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 12,
  },
  sheetHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: FONTS.bodySemi,
    fontSize: 14.5,
    color: '#111827',
  },
  optionSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  sheetCancelBtn: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 14,
    color: '#374151',
  },
  bodyTouchable: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  seeMoreInlineText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 14.5,
    color: '#0a66c2',
    fontWeight: '600',
  },

  pdfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: RADIUS.md,
    marginHorizontal: 16,
    padding: 12,
    marginBottom: 10,
  },
  pdfIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  pdfInfo: {
    flex: 1,
  },
  pdfName: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: '#0f172a',
  },
  pdfMeta: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  mediaContainer: {
    marginBottom: 0,
  },
  singleImageWrap: {
    width: '100%',
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  multiImageGrid: {
    flexDirection: 'row',
    height: 180,
    gap: 3,
  },
  gridImageWrap: {
    flex: 1,
    height: '100%',
    backgroundColor: '#f1f5f9',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreImagesText: {
    color: '#ffffff',
    fontFamily: FONTS.displayBold,
    fontSize: 20,
  },
  singleActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  actionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  actionCountText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: '#64748b',
  },
});
