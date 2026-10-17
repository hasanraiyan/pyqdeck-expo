import React, { useEffect, useRef } from 'react';
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

interface PendingPostCardProps {
  upload: PendingPostUpload;
  onCancel: (id: string) => void;
}

export const PendingPostCard: React.FC<PendingPostCardProps> = ({
  upload,
  onCancel,
}) => {
  const animatedProgress = useRef(new Animated.Value(upload.progress)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: upload.progress,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [upload.progress, animatedProgress]);

  const handleCancel = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onCancel(upload.id);
  };

  const authorInitial = (upload.author.name?.[0] || 'Y').toUpperCase();
  const progressPercent = Math.min(100, Math.round(upload.progress * 100));

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.card}>
      {/* Top Animated Progress Loading Line */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
      </View>

      <View style={styles.contentWrap}>
        {/* Header Row: Author Info + Status Indicator + Cancel Button */}
        <View style={styles.headerRow}>
          {upload.author.avatarUrl ? (
            <Image
              source={{ uri: upload.author.avatarUrl }}
              style={styles.avatarImg}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{authorInitial}</Text>
            </View>
          )}

          <View style={styles.authorMeta}>
            <Text style={styles.authorName} numberOfLines={1}>
              {upload.author.name}
            </Text>
            <View style={styles.statusRow}>
              <ActivityIndicator size={10} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.statusText}>
                Publishing to community... {progressPercent}%
              </Text>
            </View>
          </View>

          {/* Cancel Post Button */}
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.cancelBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Cancel publishing post"
          >
            <Feather name="x" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Post Text Preview */}
        {upload.body.trim().length > 0 && (
          <Text style={styles.bodyPreview} numberOfLines={2}>
            {upload.body}
          </Text>
        )}

        {/* Attached Media Preview Strip */}
        {upload.attachments.length > 0 && (
          <View style={styles.mediaRow}>
            {upload.attachments.slice(0, 4).map((att) => (
              <View key={att.id} style={styles.thumbWrapper}>
                {att.type === 'image' ? (
                  <Image source={{ uri: att.url }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={styles.thumbPdf}>
                    <Feather name="file-text" size={14} color={COLORS.primary} />
                  </View>
                )}
              </View>
            ))}
            {upload.attachments.length > 4 && (
              <View style={styles.moreBadge}>
                <Text style={styles.moreBadgeText}>+{upload.attachments.length - 4}</Text>
              </View>
            )}
            <Text style={styles.mediaCountText}>
              {upload.attachments.length} attachment{upload.attachments.length > 1 ? 's' : ''} uploading
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  contentWrap: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.secondaryLight,
    borderWidth: 1,
    borderColor: 'rgba(31, 75, 67, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: COLORS.secondary,
  },
  authorMeta: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  authorName: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: '#111827',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  statusText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.primary,
  },
  cancelBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyPreview: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    color: '#4b5563',
    lineHeight: 19,
    marginTop: 8,
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  thumbWrapper: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPdf: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBadge: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.sm,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBadgeText: {
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    color: '#475569',
  },
  mediaCountText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 4,
  },
});
