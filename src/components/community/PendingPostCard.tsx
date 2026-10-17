import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import { PendingPostUpload } from '../../types/community';
import { NativeContentRenderer } from '../NativeContentRenderer';
import { baseMarkdownStyles } from '../../theme/markdownStyles';
import { formatHashtagsForMarkdown } from '../../utils/communityFormatters';
import { CommunityMultiImageCarousel } from './CommunityMultiImageCarousel';
import { CommunityDocumentSlide } from './CommunityDocumentSlide';

interface PendingPostCardProps {
  upload: PendingPostUpload;
  onCancel: (id: string) => void;
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
};

export const PendingPostCard: React.FC<PendingPostCardProps> = ({
  upload,
  onCancel,
}) => {
  const animatedProgress = useRef(new Animated.Value(upload.progress)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: upload.progress,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [upload.progress, animatedProgress]);

  // Continuous left-to-right shimmer animation while sending
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const handleCancel = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onCancel(upload.id);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || 'Y').toUpperCase();
  };

  const progressPercent = Math.min(100, Math.round(upload.progress * 100));

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const displayContent = useMemo(() => {
    return formatHashtagsForMarkdown(upload.body);
  }, [upload.body]);

  const images = useMemo(
    () =>
      upload.attachments
        .filter((a) => a.type === 'image')
        .map((a, i) => ({ id: a.id || `img-${i}`, src: a.url, alt: a.name })),
    [upload.attachments]
  );

  const pdfAttachment = useMemo(
    () => upload.attachments.find((a) => a.type === 'pdf'),
    [upload.attachments]
  );

  return (
    <View style={styles.cardContainer}>
      {/* Header Row: Same UI as CommunityPostCard */}
      <View style={styles.headerRow}>
        <View style={styles.authorSection}>
          {upload.author.avatarUrl ? (
            <Image
              source={{ uri: upload.author.avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarMonogram}>
              <Text style={styles.avatarMonogramText}>
                {getInitials(upload.author.name)}
              </Text>
            </View>
          )}

          <View style={styles.authorMeta}>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorName} numberOfLines={1}>
                {upload.author.name}
              </Text>
              <Text style={styles.timeDot}>•</Text>
              <View style={styles.sendingBadge}>
                <ActivityIndicator size={10} color="#dc2626" style={{ marginRight: 4 }} />
                <Text style={styles.sendingText}>Posting... {progressPercent}%</Text>
              </View>
            </View>
            {upload.author.bio ? (
              <Text style={styles.authorBio} numberOfLines={1} ellipsizeMode="tail">
                {upload.author.bio}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Cancel Post Button */}
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.cancelBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Cancel posting"
          accessibilityRole="button"
        >
          <Feather name="x" size={13} color="#dc2626" />
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Main Post Body (Markdown & Hashtags) */}
      {upload.body.trim().length > 0 && (
        <View style={styles.bodyWrap}>
          <NativeContentRenderer
            content={displayContent}
            variant="question"
            fontSize={14.5}
            markdownStyles={postMarkdownStyles}
          />
        </View>
      )}

      {/* PDF Document Slide (if attached) */}
      {pdfAttachment && (
        <CommunityDocumentSlide
          attachment={pdfAttachment}
          onOpenFullscreen={() => {}}
        />
      )}

      {/* Images Presentation (if attached) */}
      {images.length > 0 && (
        <View style={styles.mediaContainer}>
          {images.length === 1 ? (
            <View style={styles.singleImageWrap}>
              <Image
                source={{ uri: images[0].src }}
                style={styles.singleImage}
                contentFit="cover"
                transition={200}
              />
            </View>
          ) : (
            <CommunityMultiImageCarousel
              images={images}
              onOpenImage={() => {}}
            />
          )}
        </View>
      )}

      {/* Merged Single-Line Action Bar (Muted during sending) */}
      <View style={styles.singleActionsBar}>
        <View style={styles.actionTab}>
          <Feather name="thumbs-up" size={18} color="#9ca3af" />
          <Text style={styles.actionTextMuted}>Like</Text>
        </View>
        <View style={styles.actionTab}>
          <Feather name="message-square" size={18} color="#9ca3af" />
          <Text style={styles.actionTextMuted}>Comment</Text>
        </View>
        <View style={styles.actionTab}>
          <Feather name="share-2" size={18} color="#9ca3af" />
          <Text style={styles.actionTextMuted}>Share</Text>
        </View>
        <View style={styles.actionTab}>
          <Feather name="bookmark" size={18} color="#9ca3af" />
          <Text style={styles.actionTextMuted}>Save</Text>
        </View>
      </View>

      {/* Red Loading Progress Bar at the bottom below footer */}
      <View style={styles.bottomProgressTrack}>
        <Animated.View style={[styles.bottomProgressBar, { width: progressWidth }]}>
          <Animated.View
            style={[
              styles.shimmerEffect,
              {
                transform: [
                  {
                    translateX: shimmerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-80, 420],
                    }),
                  },
                ],
              },
            ]}
          />
        </Animated.View>
      </View>
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
    overflow: 'hidden',
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
    backgroundColor: COLORS.secondaryLight,
    borderWidth: 1,
    borderColor: 'rgba(31, 75, 67, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMonogramText: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: COLORS.secondary,
  },
  authorMeta: {
    marginLeft: 11,
    flex: 1,
    justifyContent: 'center',
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  authorName: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: '#0f172a',
  },
  timeDot: {
    fontSize: 11,
    color: '#94a3b8',
    marginHorizontal: 5,
  },
  sendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: RADIUS.full,
  },
  sendingText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: '#dc2626',
  },
  authorBio: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 3,
  },
  cancelBtnText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: '#dc2626',
  },
  bodyWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  mediaContainer: {
    marginBottom: 0,
  },
  singleImageWrap: {
    width: '100%',
    aspectRatio: 1.33,
    maxHeight: 420,
    minHeight: 180,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  singleImage: {
    width: '100%',
    height: '100%',
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
  actionTextMuted: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: '#9ca3af',
  },
  bottomProgressTrack: {
    width: '100%',
    height: 3.5,
    backgroundColor: '#fee2e2',
    overflow: 'hidden',
  },
  bottomProgressBar: {
    height: '100%',
    backgroundColor: '#dc2626',
    position: 'relative',
    overflow: 'hidden',
  },
  shimmerEffect: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});
