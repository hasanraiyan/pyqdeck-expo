import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import YoutubePlayer, { PLAYER_STATES } from 'react-native-youtube-iframe';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { getYouTubeThumbnailUrl } from '../utils/youtubeParser';

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
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const initialWidth = Dimensions.get('window').width - 32;
  const [containerWidth, setContainerWidth] = useState<number>(initialWidth > 0 ? initialWidth : 360);
  const [thumbLoading, setThumbLoading] = useState(true);
  const [thumbQuality, setThumbQuality] = useState<'maxres' | 'hq' | 'mq'>('maxres');

  const thumbUrl = useMemo(
    () => getYouTubeThumbnailUrl(videoId, thumbQuality),
    [videoId, thumbQuality]
  );

  const formattedStartTime = useMemo(() => {
    if (!startTime || startTime <= 0) return null;
    const m = Math.floor(startTime / 60);
    const s = Math.floor(startTime % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [startTime]);

  const handleOpenApp = async () => {
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

  const handleInlinePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlayerError(false);
    setIsPlaying(true);
  };

  const handleStopPlaying = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPlaying(false);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 1) {
      setContainerWidth(width);
    }
  };

  const handleThumbError = () => {
    if (thumbQuality === 'maxres') {
      setThumbQuality('hq');
    } else if (thumbQuality === 'hq') {
      setThumbQuality('mq');
    } else {
      setThumbLoading(false);
    }
  };

  // Calculate strict 16:9 player and thumbnail height
  const playerHeight = useMemo(() => {
    const w = containerWidth > 0 ? containerWidth : initialWidth;
    return Math.round((w * 9) / 16);
  }, [containerWidth, initialWidth]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Video Player or Thumbnail Poster with explicit 16:9 full height */}
        <View
          style={[styles.playerContainer, { height: playerHeight }]}
          onLayout={onLayout}
        >
          {isPlaying ? (
            playerError ? (
              <View style={styles.errorOverlay}>
                <Feather name="alert-circle" size={28} color={COLORS.primary} />
                <Text style={styles.errorTitle}>Playback Error</Text>
                <Text style={styles.errorSubtitle}>
                  This video cannot be played inline. Open directly in YouTube.
                </Text>
                <View style={styles.errorActions}>
                  <TouchableOpacity
                    style={styles.errorAppBtn}
                    onPress={handleOpenApp}
                    activeOpacity={0.8}
                  >
                    <Feather name="external-link" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.errorAppBtnText}>Open in YouTube</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.errorRetryBtn}
                    onPress={() => setIsPlaying(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.errorRetryBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ width: '100%', height: playerHeight, position: 'relative' }}>
                <YoutubePlayer
                  height={playerHeight}
                  width={containerWidth > 0 ? containerWidth : undefined}
                  play={true}
                  videoId={videoId}
                  initialPlayerParams={{
                    start: startTime,
                    rel: false,
                    preventFullScreen: false,
                  }}
                  onChangeState={(state: PLAYER_STATES) => {
                    if (state === PLAYER_STATES.ENDED) {
                      setIsPlaying(false);
                    }
                  }}
                  onError={(err: string) => {
                    console.warn('YouTube Player error:', err);
                    setPlayerError(true);
                  }}
                  webViewProps={{
                    androidLayerType: 'hardware',
                    allowsInlineMediaPlayback: true,
                  }}
                />

                {/* Subtle Close Player Button */}
                <TouchableOpacity
                  style={styles.closePlayerBtn}
                  onPress={handleStopPlaying}
                  activeOpacity={0.7}
                  accessibilityLabel="Stop video"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={14} color="#ffffff" />
                </TouchableOpacity>
              </View>
            )
          ) : (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleInlinePlay}
              style={styles.posterTouchable}
              accessibilityLabel={`Play video: ${title || 'YouTube Video'}`}
            >
              <Image
                source={{ uri: thumbUrl }}
                style={styles.posterImage}
                resizeMode="cover"
                onLoadStart={() => setThumbLoading(true)}
                onLoadEnd={() => setThumbLoading(false)}
                onError={handleThumbError}
              />

              {thumbLoading && (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              )}

              {/* YouTube Play Button Badge Centered */}
              <View style={styles.playOverlay}>
                <View style={styles.playButton}>
                  <Feather name="play" size={24} color="#ffffff" style={{ marginLeft: 3 }} />
                </View>
              </View>

              {/* Badges */}
              <View style={styles.badgeTopRight}>
                <Text style={styles.badgeText}>YOUTUBE</Text>
              </View>

              {formattedStartTime && (
                <View style={styles.badgeBottomRight}>
                  <Feather name="clock" size={10} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.badgeText}>{formattedStartTime}</Text>
                </View>
              )}
            </TouchableOpacity>
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
                ? `Starts at ${formattedStartTime} • Tap to play inline or open in app`
                : 'Tap to play inline or open in YouTube app'}
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
  posterTouchable: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#0a0e14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  loaderWrap: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e02424', // YouTube red
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  closePlayerBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  badgeTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeBottomRight: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
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
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  errorAppBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  errorRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorRetryBtnText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
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
