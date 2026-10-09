import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  LayoutChangeEvent,
  Dimensions,
  Platform,
} from 'react-native';
import { YouTubePlayer } from './YouTubePlayer';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS } from '../theme/colors';

interface YouTubeCardProps {
  videoId: string;
  title?: string;
  url?: string;
  startTime?: number;
  autoPlay?: boolean;
}

export const YouTubeCard: React.FC<YouTubeCardProps> = React.memo(({
  videoId,
  title,
  url = `https://www.youtube.com/watch?v=${videoId}`,
  startTime,
  autoPlay = false,
}) => {
  const [playerError, setPlayerError] = useState(false);
  const initialWidth = Dimensions.get('window').width - 32;
  const [containerWidth, setContainerWidth] = useState<number>(initialWidth > 0 ? initialWidth : 360);

  const formattedStartTime = useMemo(() => {
    if (!startTime || startTime <= 0) return null;
    const m = Math.floor(startTime / 60);
    const s = Math.floor(startTime % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [startTime]);

  const handleOpenApp = async () => {
    if (Platform.OS === 'web') {
      await Linking.openURL(url).catch(() => {});
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const appUrl = `vnd.youtube://${videoId}`;
    const canOpen = await Linking.canOpenURL(appUrl).catch(() => false);

    if (canOpen) {
      await Linking.openURL(appUrl).catch(() => Linking.openURL(url));
    } else {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: COLORS.card,
        controlsColor: COLORS.primary,
        secondaryToolbarColor: COLORS.background,
        showTitle: true,
        enableBarCollapsing: true,
      }).catch(() => {
        Linking.openURL(url).catch(() => {});
      });
    }
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 1) {
      setContainerWidth(width);
    }
  };

  // Strict 16:9 aspect ratio height
  const playerHeight = useMemo(() => {
    const w = containerWidth > 0 ? containerWidth : initialWidth;
    return Math.round((w * 9) / 16);
  }, [containerWidth, initialWidth]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View
          style={[styles.playerContainer, { height: playerHeight }]}
          onLayout={onLayout}
        >
          {playerError ? (
            <View style={styles.errorOverlay}>
              <Feather name="alert-circle" size={28} color={COLORS.primary} />
              <Text style={styles.errorTitle}>Playback Unavailable Inline</Text>
              <Text style={styles.errorSubtitle}>
                This video cannot be played inside the embedded player.
              </Text>
              <TouchableOpacity
                style={styles.errorAppBtn}
                onPress={handleOpenApp}
                activeOpacity={0.8}
              >
                <Feather name="external-link" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.errorAppBtnText}>Open in YouTube</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <YouTubePlayer
              height={playerHeight}
              width={containerWidth > 0 ? containerWidth : undefined}
              autoPlay={autoPlay}
              videoId={videoId}
              startTime={startTime}
              title={title}
              onError={(err: string) => {
                console.warn('YouTube Player error:', err);
                setPlayerError(true);
              }}
            />
          )}
        </View>

        {/* Bottom Metadata & External Launcher Bar */}
        <View style={styles.footerBar}>
          <View style={styles.titleWrap}>
            <Text style={styles.videoTitle} numberOfLines={1}>
              {title || 'Recommended Lecture / Video Explanation'}
            </Text>
            <Text style={styles.channelSubtitle} numberOfLines={1}>
              {formattedStartTime
                ? `Starts at ${formattedStartTime} • YouTube Video Lecture`
                : 'YouTube Video Lecture'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleOpenApp}
            style={styles.openAppBtn}
            activeOpacity={0.7}
            accessibilityLabel="Open in YouTube app"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="external-link" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
    width: '100%',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  playerContainer: {
    width: '100%',
    backgroundColor: '#0a0e14',
    position: 'relative',
    overflow: 'hidden',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  errorAppBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  titleWrap: {
    flex: 1,
    marginRight: 10,
  },
  videoTitle: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  channelSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  openAppBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
