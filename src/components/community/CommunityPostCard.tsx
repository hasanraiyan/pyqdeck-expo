import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { CommunityPost } from '../../types/community';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import { ImageViewerModal } from '../ImageViewerModal';
import { NativeContentRenderer } from '../NativeContentRenderer';
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
}

export function formatHashtagsForMarkdown(text: string): string {
  if (!text) return '';
  const shielded: string[] = [];
  const placeholder = (match: string) => {
    shielded.push(match);
    return `\uE002${shielded.length - 1}\uE003`;
  };

  let prepared = text
    .replace(/```[\s\S]*?```/g, placeholder)
    .replace(/`[^`\n]+`/g, placeholder)
    .replace(/\$\$[\s\S]*?\$\$/g, placeholder)
    .replace(/\$[^\$\n]+\$/g, placeholder);

  prepared = prepared.replace(
    /(^|[\s(\[])#([A-Za-z0-9_-]+)/g,
    (_, prefix, tag) => `${prefix}[#${tag}](hashtag:${tag})`
  );

  return prepared.replace(/\uE002(\d+)\uE003/g, (_, i) => shielded[Number(i)]);
}

export function truncateMarkdownSafely(text: string, limit = 220): string {
  if (text.length <= limit) return text;

  let truncated = text.slice(0, limit);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > limit * 0.7) {
    truncated = truncated.slice(0, lastSpace);
  }

  // Close unclosed bold (**)
  const boldMatches = truncated.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    truncated += '**';
  }

  // Close unclosed italic (*)
  const strippedBold = truncated.replace(/\*\*/g, '');
  const italicMatches = strippedBold.match(/\*/g);
  if (italicMatches && italicMatches.length % 2 !== 0) {
    truncated += '*';
  }

  // Close unclosed inline code (`)
  const codeMatches = truncated.match(/`/g);
  if (codeMatches && codeMatches.length % 2 !== 0) {
    truncated += '`';
  }

  // Close unclosed display math ($$) or inline math ($)
  const displayMathMatches = truncated.match(/\$\$/g);
  if (displayMathMatches && displayMathMatches.length % 2 !== 0) {
    truncated += '$$';
  } else {
    const strippedDisplay = truncated.replace(/\$\$/g, '');
    const inlineMathMatches = strippedDisplay.match(/\$/g);
    if (inlineMathMatches && inlineMathMatches.length % 2 !== 0) {
      truncated += '$';
    }
  }

  return truncated.trim();
}

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

export const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
  post,
  onLikePress,
  onBookmarkPress,
  onHashtagPress,
  onCommentPress,
  onOpenDetail,
  onDismissPost,
  initialExpanded = false,
}) => {
  const navigation = useNavigation<any>();
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [expandedText, setExpandedText] = useState(initialExpanded);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  const images = post.attachments
    .filter((a) => a.type === 'image')
    .map((a) => ({ src: a.url, alt: a.name || post.body.slice(0, 50) }));

  const pdfAttachment = post.attachments.find((a) => a.type === 'pdf');

  const handleOpenImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedImageIndex(index);
    setImageViewerVisible(true);
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

  const handleDiscard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDismissPost?.(post.id);
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

  const isLong = post.body.length > 220;

  const displayContent = useMemo(() => {
    if (isLong && !expandedText) {
      const truncated = truncateMarkdownSafely(post.body, 220);
      return `${formatHashtagsForMarkdown(truncated)}... [see more](action:see_more)`;
    }
    return formatHashtagsForMarkdown(post.body);
  }, [post.body, isLong, expandedText]);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || '?').toUpperCase();
  };

  return (
    <View style={styles.cardContainer}>
      {/* Clean Post Header: Profile Name + Time, 3-Dot Options & Discard Cross */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.authorSection}
          activeOpacity={0.8}
          onPress={() => onOpenDetail?.(post)}
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

          <TouchableOpacity
            onPress={handleDiscard}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={styles.headerActionBtn}
            accessibilityRole="button"
            accessibilityLabel="Discard post"
          >
            <Feather name="x" size={18} color={COLORS.textSubtle} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Post Body (Full Markdown & LaTeX Support with Inline See More) */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onOpenDetail?.(post)}
        style={styles.bodyTouchable}
      >
        <NativeContentRenderer
          content={displayContent}
          variant="question"
          fontSize={14.5}
          markdownStyles={postMarkdownStyles}
          rules={postMarkdownRules}
        />
      </TouchableOpacity>



      {/* PDF Document Preview (LinkedIn style) */}
      {pdfAttachment && (
        <TouchableOpacity
          style={styles.pdfCard}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            if (pdfAttachment.thumbnailUrl) {
              setSelectedImageIndex(0);
              setImageViewerVisible(true);
            } else {
              Alert.alert('PDF Document', `${pdfAttachment.name}\nReady to view/download.`);
            }
          }}
        >
          <View style={styles.pdfIconWrap}>
            <Feather name="file-text" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.pdfInfo}>
            <Text style={styles.pdfName} numberOfLines={1}>
              {pdfAttachment.name || 'Document.pdf'}
            </Text>
            <Text style={styles.pdfMeta}>
              {pdfAttachment.pageCount ? `${pdfAttachment.pageCount} pages • ` : ''}
              {pdfAttachment.size || 'PDF'}
            </Text>
          </View>
          <Feather name="external-link" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}

      {/* Images presentation */}
      {images.length > 0 && (
        <View style={styles.mediaContainer}>
          {images.length === 1 ? (
            <TouchableOpacity
              activeOpacity={0.92}
              style={styles.singleImageWrap}
              onPress={() => handleOpenImage(0)}
            >
              <Image
                source={{ uri: images[0].src }}
                style={styles.singleImage}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.multiImageGrid}>
              {images.slice(0, 2).map((img, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.92}
                  style={styles.gridImageWrap}
                  onPress={() => handleOpenImage(idx)}
                >
                  <Image
                    source={{ uri: img.src }}
                    style={styles.gridImage}
                    contentFit="cover"
                    transition={200}
                  />
                  {idx === 1 && images.length > 2 && (
                    <View style={styles.moreImagesOverlay}>
                      <Text style={styles.moreImagesText}>+{images.length - 2}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Social Engagement Count Line (LinkedIn style) */}
      <View style={styles.socialCountsRow}>
        <View style={styles.reactionCountBadge}>
          <View style={styles.reactionIconCircle}>
            <Feather name="thumbs-up" size={10} color="#ffffff" />
          </View>
          <Text style={styles.socialCountsText}>{post.likesCount}</Text>
        </View>

        <TouchableOpacity onPress={() => onCommentPress?.(post)}>
          <Text style={styles.socialCountsText}>
            {post.commentsCount} {post.commentsCount === 1 ? 'comment' : 'comments'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* LinkedIn 4-Action Bar: Like, Comment, Repost/Share, Save */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.actionTab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onLikePress(post.id);
          }}
          activeOpacity={0.7}
        >
          <Feather
            name="thumbs-up"
            size={16}
            color={post.isLiked ? COLORS.primary : COLORS.textMuted}
          />
          <Text
            style={[
              styles.actionTabText,
              post.isLiked && { color: COLORS.primary, fontFamily: FONTS.displayBold },
            ]}
          >
            Like
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTab}
          onPress={() => onCommentPress?.(post)}
          activeOpacity={0.7}
        >
          <Feather name="message-square" size={16} color={COLORS.textMuted} />
          <Text style={styles.actionTabText}>Comment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTab}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Feather name="repeat" size={16} color={COLORS.textMuted} />
          <Text style={styles.actionTabText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onBookmarkPress(post.id);
          }}
          activeOpacity={0.7}
        >
          <Feather
            name="bookmark"
            size={16}
            color={post.isBookmarked ? COLORS.secondary : COLORS.textMuted}
          />
          <Text
            style={[
              styles.actionTabText,
              post.isBookmarked && { color: COLORS.secondary, fontFamily: FONTS.displayBold },
            ]}
          >
            Save
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lightbox Image Viewer */}
      {images.length > 0 && (
        <ImageViewerModal
          visible={imageViewerVisible}
          images={images}
          initialIndex={selectedImageIndex}
          onClose={() => setImageViewerVisible(false)}
        />
      )}

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
                onBookmarkPress(post.id);
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

            {/* Report post */}
            <TouchableOpacity
              style={[styles.optionItem, { borderBottomWidth: 0 }]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setOptionsModalVisible(false);
                Alert.alert(
                  'Report Post',
                  'Thank you for reporting. Our moderation team will review this post.',
                  [{ text: 'OK' }]
                );
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f4f6',
  },
  avatarMonogram: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMonogramText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: '#1d4ed8',
  },
  authorMeta: {
    marginLeft: 9,
    flex: 1,
    justifyContent: 'center',
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  authorName: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#111827',
    flexShrink: 1,
  },
  timeDot: {
    fontSize: 11,
    color: '#9ca3af',
  },
  timeText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#6b7280',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerActionBtn: {
    padding: 5,
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
    fontSize: 14,
    color: '#6b7280',
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
    marginBottom: 8,
  },
  singleImageWrap: {
    width: '100%',
    height: 220,
    backgroundColor: '#f1f5f9',
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
  socialCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  reactionCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reactionIconCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#0a66c2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialCountsText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#6b7280',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingVertical: 4,
  },
  actionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  actionTabText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12.5,
    color: '#4b5563',
  },
});
