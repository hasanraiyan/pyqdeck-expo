import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { ImageItem } from '../utils/imageGalleryParser';
import { useImageDimensions } from '../utils/useImageDimensions';

interface ImageViewerModalProps {
  visible: boolean;
  images: ImageItem[];
  initialIndex?: number;
  onClose: () => void;
}

/**
 * Escape a URL/caption for safe injection into an HTML attribute.
 * Unsplash URLs carry `&fit=crop&w=...` query strings — a raw `&` inside
 * `src="..."` starts an HTML entity and truncates the URL, which was one
 * reason the demo lightbox always showed "Failed to load image".
 */
const escapeHtmlAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  images,
  initialIndex = 0,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [copied, setCopied] = useState(false);
  const [webLoading, setWebLoading] = useState(true);
  const [webError, setWebError] = useState<string | null>(null);
  const [webKey, setWebKey] = useState(0);

  // Sync active index whenever modal opens / image changes; reset load state
  React.useEffect(() => {
    if (visible) {
      setActiveIndex(Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1)));
      setCopied(false);
      setWebLoading(true);
      setWebError(null);
    }
  }, [visible, initialIndex, images.length]);

  const activeImage = images[activeIndex] || images[0];
  const activeSrc = (activeImage?.src || '').trim();
  const { dims, orientation } = useImageDimensions(visible ? activeSrc : null);

  // Warm the expo-image disk cache so a WebView retry usually hits cache.
  React.useEffect(() => {
    if (visible && activeSrc.startsWith('http')) {
      Image.prefetch(activeSrc, 'disk').catch(() => {});
    }
  }, [visible, activeSrc]);

  const handleCopy = async () => {
    if (!activeSrc) return;
    await Clipboard.setStringAsync(activeSrc);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectTab = (idx: number) => {
    if (idx === activeIndex) return;
    Haptics.selectionAsync();
    setActiveIndex(idx);
    setWebLoading(true);
    setWebError(null);
  };

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setWebError(null);
    setWebLoading(true);
    setWebKey((k) => k + 1);
  };

  // HTML rendering the active image with responsive fit and pinch-to-zoom.
  // baseUrl + universal-access flags let Android load https subresources
  // from inline HTML; without them the image request is blocked and the
  // old `onerror` div always showed "check your internet connection".
  const htmlContent = useMemo(() => {
    if (!visible || !activeSrc) return '';

    const safeSrc = escapeHtmlAttr(activeSrc);
    const safeAlt = escapeHtmlAttr(activeImage?.alt || 'Figure');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: ${COLORS.background};
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #wrapper {
      padding: 16px;
      min-width: 100%;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    img {
      max-width: 96%;
      max-height: 85vh;
      object-fit: contain;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      user-select: none;
      -webkit-user-select: none;
    }
  </style>
</head>
<body>
  <div id="wrapper">
    <img
      src="${safeSrc}"
      alt="${safeAlt}"
      referrerpolicy="no-referrer"
      onload="window.ReactNativeWebView && window.ReactNativeWebView.postMessage('IMG_OK');"
      onerror="window.ReactNativeWebView && window.ReactNativeWebView.postMessage('IMG_FAIL'); this.style.display='none';"
    />
  </div>
</body>
</html>`;
  }, [visible, activeSrc, activeImage?.alt]);

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
        {/* Top Header matching app's Exam Paper style */}
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={onClose}
              accessibilityLabel="Close image viewer"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="arrow-left" size={20} color={COLORS.text} />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {images.length > 1
                  ? `FIGURE ${activeIndex + 1} OF ${images.length}`
                  : 'FIGURE VIEWER'}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {activeImage?.alt || 'Pinch or double-tap to zoom'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleCopy}
              accessibilityLabel="Copy image URL"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather
                name={copied ? 'check' : 'link'}
                size={18}
                color={copied ? COLORS.secondary : COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Fullscreen Pinch-to-Zoom View */}
        <View style={styles.viewerWrapper}>
          <WebView
            key={`web-${activeIndex}-${webKey}`}
            originWhitelist={['*']}
            source={{ html: htmlContent, baseUrl: 'https://localhost/' }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            mixedContentMode="always"
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            scrollEnabled
            bounces
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            startInLoadingState={false}
            onLoadStart={() => {
              setWebLoading(true);
              setWebError(null);
            }}
            onLoadEnd={() => setWebLoading(false)}
            onError={(e) => {
              setWebLoading(false);
              setWebError(e.nativeEvent?.description || 'Web viewer failed to load.');
            }}
            onHttpError={(e) => {
              if (e.nativeEvent?.statusCode >= 400) {
                setWebLoading(false);
                setWebError(`Image server returned ${e.nativeEvent.statusCode}.`);
              }
            }}
            onMessage={(e) => {
              const msg = e.nativeEvent?.data;
              if (msg === 'IMG_OK') {
                setWebLoading(false);
                setWebError(null);
              } else if (typeof msg === 'string' && msg.startsWith('IMG_FAIL')) {
                setWebLoading(false);
                setWebError('The image URL could not be fetched.');
              }
            }}
          />
          {webLoading && !webError && (
            <View style={styles.viewerOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.viewerOverlayText}>Loading figure…</Text>
            </View>
          )}
          {webError && (
            <View style={styles.viewerOverlay}>
              <View style={styles.viewerErrorCard}>
                <Feather name="wifi-off" size={22} color={COLORS.primary} />
                <Text style={styles.viewerErrorTitle}>Couldn't load this figure</Text>
                <Text style={styles.viewerErrorUrl} numberOfLines={2}>
                  {activeSrc}
                </Text>
                <Text style={styles.viewerErrorHint}>
                  {webError} Check your connection, then try again — the grid
                  thumbnails use the same URL, so a retry here fixes both.
                </Text>
                <View style={styles.viewerErrorRow}>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={handleRetry}
                    activeOpacity={0.8}
                  >
                    <Feather name="refresh-cw" size={14} color="#fff" />
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={handleCopy}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name={copied ? 'check' : 'link'}
                      size={14}
                      color={COLORS.primary}
                    />
                    <Text style={styles.copyBtnText}>
                      {copied ? 'Copied' : 'Copy URL'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Bottom thumbnail strip if multiple images matching app design */}
        {images.length > 1 && (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailStrip}
            >
              {images.map((img, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <TouchableOpacity
                    key={`thumb-${idx}`}
                    onPress={() => handleSelectTab(idx)}
                    activeOpacity={0.7}
                    style={[
                      styles.thumbPill,
                      isActive && styles.thumbPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.thumbPillText,
                        isActive && styles.thumbPillTextActive,
                      ]}
                    >
                      {img.alt ? (img.alt.length > 16 ? `${img.alt.substring(0, 14)}…` : img.alt) : `Fig ${idx + 1}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
    maxWidth: '90%',
  },
  viewerWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  viewerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },
  viewerOverlayText: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONTS.mono,
  },
  viewerErrorCard: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 18,
    maxWidth: 340,
    width: '100%',
  },
  viewerErrorTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONTS.mono,
  },
  viewerErrorUrl: {
    marginTop: 6,
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: FONTS.mono,
    textAlign: 'center',
  },
  viewerErrorHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  viewerErrorRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
  },
  copyBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  bottomBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  thumbnailStrip: {
    paddingHorizontal: 16,
    gap: 8,
  },
  thumbPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thumbPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  thumbPillText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  thumbPillTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
