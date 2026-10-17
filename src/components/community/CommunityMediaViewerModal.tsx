import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StatusBar,
  Share,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import { CommunityPost } from '../../types/community';
import { NativeContentRenderer } from '../NativeContentRenderer';
import { baseMarkdownStyles, markdownRules } from '../../theme/markdownStyles';
import {
  formatHashtagsForMarkdown,
  truncateMarkdownSafely,
} from '../../utils/communityFormatters';

interface MediaItem {
  uri: string;
  name?: string;
  pageIndex?: number;
  totalPages?: number;
}

interface CommunityMediaViewerModalProps {
  visible: boolean;
  post: CommunityPost;
  initialIndex?: number;
  initialType?: 'document' | 'image';
  onClose: () => void;
  onLikePress?: (postId: string) => void;
  onCommentPress?: (post: CommunityPost) => void;
  onSharePress?: () => void;
  onOpenDetail?: (post: CommunityPost) => void;
}

export const CommunityMediaViewerModal: React.FC<CommunityMediaViewerModalProps> = ({
  visible,
  post,
  initialIndex = 0,
  initialType = 'image',
  onClose,
  onLikePress,
  onCommentPress,
  onSharePress,
  onOpenDetail,
}) => {
  const insets = useSafeAreaInsets();
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [windowHeight, setWindowHeight] = useState(Dimensions.get('window').height);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isLikedState, setIsLikedState] = useState(post.isLiked);
  const [likesCountState, setLikesCountState] = useState(post.likesCount);
  const flatListRef = useRef<FlatList<MediaItem>>(null);

  const pdfAttachment = post.attachments.find((a) => a.type === 'pdf');
  const isDocument = initialType === 'document' && !!pdfAttachment;
  const [scrollMode, setScrollMode] = useState<'vertical' | 'horizontal'>(
    isDocument ? 'vertical' : 'horizontal'
  );

  // Sync scrollMode if initialType or visible changes
  useEffect(() => {
    if (visible) {
      setScrollMode(initialType === 'document' ? 'vertical' : 'horizontal');
    }
  }, [visible, initialType]);

  const isVertical = scrollMode === 'vertical';
  const PAGE_GAP = 14;
  const docPageWidth = Math.min(windowWidth - 20, 680);
  const docPageHeight = Math.round(docPageWidth * 1.414);

  // Sync like state from post prop
  useEffect(() => {
    setIsLikedState(post.isLiked);
    setLikesCountState(post.likesCount);
  }, [post.isLiked, post.likesCount]);

  // Build items array depending on document preview pages vs image attachments
  const mediaItems: MediaItem[] = React.useMemo(() => {
    if (initialType === 'document' && pdfAttachment) {
      if (pdfAttachment.previewPages && pdfAttachment.previewPages.length > 0) {
        return pdfAttachment.previewPages.map((url, i) => ({
          uri: url,
          name: pdfAttachment.name,
          pageIndex: i + 1,
          totalPages: pdfAttachment.previewPages?.length,
        }));
      }
      if (pdfAttachment.thumbnailUrl) {
        return [
          {
            uri: pdfAttachment.thumbnailUrl,
            name: pdfAttachment.name,
            pageIndex: 1,
            totalPages: pdfAttachment.pageCount || 1,
          },
        ];
      }
    }

    const imageAttachments = post.attachments.filter((a) => a.type === 'image');
    if (imageAttachments.length > 0) {
      return imageAttachments.map((img, i) => ({
        uri: img.url,
        name: img.name,
        pageIndex: i + 1,
        totalPages: imageAttachments.length,
      }));
    }

    // Fallback if doc was opened but has no preview pages
    if (pdfAttachment?.thumbnailUrl) {
      return [
        {
          uri: pdfAttachment.thumbnailUrl,
          name: pdfAttachment.name,
          pageIndex: 1,
          totalPages: pdfAttachment.pageCount || 1,
        },
      ];
    }

    return [];
  }, [post.attachments, initialType, pdfAttachment]);

  useEffect(() => {
    if (visible) {
      const target = Math.min(Math.max(0, initialIndex), Math.max(0, mediaItems.length - 1));
      setActiveIndex(target);
      setTimeout(() => {
        if (isVertical) {
          flatListRef.current?.scrollToOffset({
            offset: target * (docPageHeight + PAGE_GAP),
            animated: false,
          });
        } else {
          flatListRef.current?.scrollToIndex({ index: target, animated: false });
        }
      }, 50);
    }
  }, [visible, initialIndex, mediaItems.length, isVertical, docPageHeight]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isVertical) {
      const offsetY = e.nativeEvent.contentOffset.y;
      const unit = docPageHeight + PAGE_GAP;
      if (unit > 0) {
        const idx = Math.round(offsetY / unit);
        const clamped = Math.max(0, Math.min(idx, mediaItems.length - 1));
        if (clamped !== activeIndex) {
          setActiveIndex(clamped);
        }
      }
    } else {
      const offsetX = e.nativeEvent.contentOffset.x;
      if (windowWidth > 0) {
        const idx = Math.round(offsetX / windowWidth);
        const clamped = Math.max(0, Math.min(idx, mediaItems.length - 1));
        if (clamped !== activeIndex) {
          setActiveIndex(clamped);
        }
      }
    }
  };

  const handleDownloadPdf = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (pdfAttachment?.url) {
      Linking.openURL(pdfAttachment.url).catch(() => {
        Alert.alert('PDF Document', `${pdfAttachment.name || 'Document'}\nReady to view/download.`);
      });
    } else {
      Alert.alert('Document', `${pdfAttachment?.name || 'Document'}`);
    }
  };

  const handleToggleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsLikedState((prev) => !prev);
    setLikesCountState((prev) => (isLikedState ? prev - 1 : prev + 1));
    onLikePress?.(post.id);
  };

  const handleInternalShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onSharePress) {
      onSharePress();
      return;
    }
    const shareUrl = `https://pyqdeck.in/community/${post.slug}`;
    const shareMessage = `Check out this document on PYQDeck Community:\n"${post.body.slice(0, 100)}..."\n\n${shareUrl}`;

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
      // User dismissed
    }
  };

  const handleOpenComments = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
    onCommentPress?.(post);
  };

  const handleOpenDetail = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
    onOpenDetail?.(post);
  }, [onClose, onOpenDetail, post]);

  const cleanAuthorCollege = post.author.college || post.author.headline || 'Student';

  // Flatten into a single line for the 1-line bottom preview
  const singleLineBody = React.useMemo(
    () => post.body.replace(/(\r\n|\n|\r)+/g, ' ').trim(),
    [post.body]
  );

  const isBodyLong = singleLineBody.length > 55;

  const displayMarkdown = React.useMemo(() => {
    if (isBodyLong) {
      const truncated = truncateMarkdownSafely(singleLineBody, 55);
      return `${formatHashtagsForMarkdown(truncated)}... [more](action:open_detail)`;
    }
    return formatHashtagsForMarkdown(singleLineBody);
  }, [singleLineBody, isBodyLong]);

  const modalMarkdownStyles = React.useMemo(
    () => ({
      ...baseMarkdownStyles,
      body: {
        color: '#f3f4f6',
        fontSize: 13.5,
        lineHeight: 18,
        fontFamily: FONTS.body,
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 0,
        flexDirection: 'row',
        flexWrap: 'wrap',
      },
      strong: {
        color: '#ffffff',
        fontFamily: FONTS.bodySemi,
        fontWeight: '700',
      },
      em: {
        color: '#f3f4f6',
        fontStyle: 'italic',
      },
      inlineCode: {
        color: '#e2e8f0',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        fontFamily: FONTS.mono,
        fontSize: 12,
        paddingHorizontal: 4,
        borderRadius: 3,
      },
      link: {
        color: '#60a5fa',
        fontFamily: FONTS.bodySemi,
        textDecorationLine: 'none',
      },
      seeMoreInlineText: {
        color: '#60a5fa',
        fontFamily: FONTS.bodySemi,
        fontSize: 13.5,
        fontWeight: '700',
      },
    }),
    []
  );

  const modalMarkdownRules = React.useMemo(
    () => ({
      ...markdownRules,
      link: (node: any, children: any, parent: any, styles: any) => {
        const href = node.attributes?.href || '';
        if (href === 'action:open_detail') {
          return (
            <Text
              key={node.key}
              style={{
                color: '#60a5fa',
                fontFamily: FONTS.bodySemi,
                fontSize: 13.5,
                fontWeight: '700',
              }}
              onPress={handleOpenDetail}
            >
              {' '}more
            </Text>
          );
        }
        return (
          <Text
            key={node.key}
            style={[
              styles.link,
              {
                color: '#60a5fa',
                fontFamily: FONTS.bodySemi,
                textDecorationLine: 'none',
              },
            ]}
            onPress={() => {
              if (href.startsWith('hashtag:')) {
                onClose();
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
    [handleOpenDetail, onClose]
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View
        style={styles.container}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0) setWindowWidth(width);
          if (height > 0) setWindowHeight(height);
        }}
      >
        {/* Top Header Bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onClose();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close media viewer"
          >
            <Feather name="arrow-left" size={24} color="#ffffff" />
          </TouchableOpacity>

          {isDocument ? (
            <View style={styles.headerDocInfo}>
              <Text style={styles.headerDocTitle} numberOfLines={1}>
                {pdfAttachment?.name || 'Document.pdf'}
              </Text>
              <Text style={styles.headerDocPages}>
                Page {activeIndex + 1} of {mediaItems.length}
              </Text>
            </View>
          ) : mediaItems.length > 1 ? (
            <View style={styles.headerCounter}>
              <Text style={styles.headerCounterText}>
                {activeIndex + 1} / {mediaItems.length}
              </Text>
            </View>
          ) : (
            <View style={{ width: 36 }} />
          )}

          {isDocument ? (
            <View style={styles.topBarDocActions}>
              {/* Toggle Scroll Mode: Vertical Continuous (Y) vs Horizontal Slide (X) */}
              <TouchableOpacity
                style={styles.topIconBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setScrollMode((prev) => (prev === 'vertical' ? 'horizontal' : 'vertical'));
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Toggle PDF scroll mode"
              >
                <Feather
                  name={isVertical ? "columns" : "align-justify"}
                  size={19}
                  color="#ffffff"
                />
              </TouchableOpacity>

              {/* Download / Open Original PDF */}
              <TouchableOpacity
                style={styles.topIconBtn}
                onPress={handleDownloadPdf}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Download PDF"
              >
                <Feather name="download" size={19} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.topBarRightSpacer} />
          )}
        </View>

        {/* Media Canvas (Vertical Continuous PDF vs Horizontal Slides) */}
        <View style={styles.canvasContainer}>
          <FlatList
            ref={flatListRef}
            key={isVertical ? 'vertical-pdf' : 'horizontal-slides'}
            data={mediaItems}
            keyExtractor={(_, idx) => `media-page-${idx}`}
            horizontal={!isVertical}
            pagingEnabled={!isVertical}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={isVertical}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            contentContainerStyle={
              isVertical
                ? {
                    paddingTop: Math.max(insets.top + 60, 80),
                    paddingBottom: Math.max(insets.bottom + 24, 40),
                    alignItems: 'center',
                    gap: PAGE_GAP,
                  }
                : undefined
            }
            getItemLayout={
              !isVertical
                ? (_, index) => ({
                    length: windowWidth,
                    offset: windowWidth * index,
                    index,
                  })
                : (_, index) => ({
                    length: docPageHeight + PAGE_GAP,
                    offset: (docPageHeight + PAGE_GAP) * index,
                    index,
                  })
            }
            renderItem={({ item, index }) => {
              if (isVertical) {
                return (
                  <View
                    style={[
                      styles.pdfPaperCard,
                      { width: docPageWidth, height: docPageHeight },
                    ]}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.pdfPaperImage}
                      contentFit="contain"
                      transition={200}
                    />
                    <View style={styles.pdfPageWatermark}>
                      <Text style={styles.pdfPageWatermarkText}>
                        Page {index + 1}
                      </Text>
                    </View>
                  </View>
                );
              }

              return (
                <View style={[styles.mediaSlide, { width: windowWidth, height: windowHeight }]}>
                  <Image
                    source={{ uri: item.uri }}
                    style={[styles.mediaImage, { width: windowWidth, height: windowHeight * 0.72 }]}
                    contentFit="contain"
                    transition={200}
                  />
                </View>
              );
            }}
          />
        </View>

        {/* Floating Right Actions Column (Images only, clean PDF viewer without social clutter) */}
        {!isDocument && (
          <View style={[styles.rightActionsColumn, { bottom: Math.max(insets.bottom + 85, 115) }]}>
            {/* Like Button */}
            <TouchableOpacity
              style={styles.verticalActionBtn}
              onPress={handleToggleLike}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Like post"
            >
              <Feather
                name="thumbs-up"
                size={24}
                color={isLikedState ? '#60a5fa' : '#ffffff'}
              />
              <Text style={[styles.actionBadgeText, isLikedState && styles.actionLikedText]}>
                {likesCountState}
              </Text>
            </TouchableOpacity>

            {/* Comment Button */}
            <TouchableOpacity
              style={styles.verticalActionBtn}
              onPress={handleOpenComments}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="View comments"
            >
              <Feather name="message-square" size={23} color="#ffffff" />
              <Text style={styles.actionBadgeText}>
                {post.commentsCount > 0 ? post.commentsCount : 0}
              </Text>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity
              style={styles.verticalActionBtn}
              onPress={handleInternalShare}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Share post"
            >
              <Feather name="share-2" size={22} color="#ffffff" />
            </TouchableOpacity>

            {/* Send / Paperplane Button */}
            <TouchableOpacity
              style={styles.verticalActionBtn}
              onPress={handleInternalShare}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Send link"
            >
              <Feather name="send" size={21} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Post & Author Overlay (Images only, clean PDF viewer without social clutter) */}
        {!isDocument && (
          <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Author Row */}
            <View style={styles.authorRow}>
              {post.author.avatarUrl ? (
                <Image
                  source={{ uri: post.author.avatarUrl }}
                  style={styles.authorAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.authorAvatarFallback}>
                  <Text style={styles.avatarInitial}>
                    {post.author.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.authorTextWrap}>
                <Text style={styles.authorNameText} numberOfLines={1}>
                  {post.author.name}
                </Text>
                <Text style={styles.authorCollegeText} numberOfLines={1}>
                  {cleanAuthorCollege}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.followPill}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  Alert.alert('Following', `You will now receive updates from ${post.author.name}`);
                }}
              >
                <Text style={styles.followPillText}>Follow</Text>
              </TouchableOpacity>
            </View>

            {/* Caption Snippet Row with Markdown & 1-line truncation */}
            <View style={styles.captionRow}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.captionTouchable}
                onPress={handleOpenDetail}
              >
                <NativeContentRenderer
                  content={displayMarkdown}
                  variant="question"
                  fontSize={13.5}
                  markdownStyles={modalMarkdownStyles}
                  rules={modalMarkdownRules}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dotsMoreBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  Alert.alert('Options', `${post.author.name}'s Post`, [
                    { text: 'View Full Post', onPress: handleOpenDetail },
                    { text: 'Copy Link', onPress: handleInternalShare },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Post options"
              >
                <Feather name="more-horizontal" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCounter: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  headerCounterText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerDocInfo: {
    alignItems: 'center',
    maxWidth: '56%',
  },
  headerDocTitle: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: '#ffffff',
    textAlign: 'center',
  },
  headerDocPages: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 1,
  },
  topBarDocActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topIconBtn: {
    padding: 6,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarRightSpacer: {
    width: 36,
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfPaperCard: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfPaperImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ffffff',
  },
  pdfPageWatermark: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pdfPageWatermarkText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  mediaSlide: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  mediaImage: {
    backgroundColor: '#000000',
  },
  rightActionsColumn: {
    position: 'absolute',
    right: 14,
    zIndex: 60,
    alignItems: 'center',
    gap: 16,
  },
  verticalActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
  },
  actionBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 3,
    textAlign: 'center',
  },
  actionLikedText: {
    color: '#60a5fa',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 55,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingRight: 55, // Don't collide with right action column
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: '#1f2937',
  },
  authorAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    color: '#ffffff',
  },
  authorTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  authorNameText: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    color: '#ffffff',
  },
  authorCollegeText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 1,
  },
  followPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ffffff',
    marginLeft: 8,
  },
  followPillText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12.5,
    color: '#ffffff',
    fontWeight: '600',
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  captionTouchable: {
    flex: 1,
    marginRight: 8,
  },
  dotsMoreBtn: {
    padding: 4,
  },
});
