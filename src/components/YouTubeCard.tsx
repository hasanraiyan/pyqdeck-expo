import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
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
  const [thumbLoading, setThumbLoading] = useState(true);
  const [thumbError, setThumbError] = useState(false);

  const thumbUrl = useMemo(
    () => getYouTubeThumbnailUrl(videoId, thumbError ? 'mq' : 'hq'),
    [videoId, thumbError]
  );

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
    setIsPlaying(true);
  };

  // Embed HTML with autoplay, hardware acceleration, and responsive 16:9 ratio
  const embedHtml = useMemo(() => {
    const startParam = startTime && startTime > 0 ? `&start=${startTime}` : '';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
    }
  </style>
</head>
<body>
  <iframe
    src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1${startParam}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
  ></iframe>
</body>
</html>`;
  }, [videoId, startTime]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Video Player or Thumbnail Poster */}
        <View style={styles.playerContainer}>
          {isPlaying ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: embedHtml }}
              style={styles.webView}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              bounces={false}
            />
          ) : (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleInlinePlay}
              style={styles.posterTouchable}
              accessibilityLabel={`Play video: ${title || 'YouTube Video'}`}
            >
              <Image
                source={{ uri: thumbUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onLoadStart={() => setThumbLoading(true)}
                onLoadEnd={() => setThumbLoading(false)}
                onError={() => {
                  setThumbLoading(false);
                  setThumbError(true);
                }}
              />

              {thumbLoading && (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              )}

              {/* YouTube Play Button Badge */}
              <View style={styles.playOverlay}>
                <View style={styles.playButton}>
                  <Feather name="play" size={24} color="#ffffff" style={{ marginLeft: 3 }} />
                </View>
              </View>

              {/* Duration / HD badge */}
              <View style={styles.badgeTopRight}>
                <Text style={styles.badgeText}>YOUTUBE</Text>
              </View>
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
              Tap to play inline or open in YouTube app
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
    aspectRatio: 16 / 9,
    backgroundColor: '#0a0e14',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  posterTouchable: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0a0e14',
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
  badgeTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
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
