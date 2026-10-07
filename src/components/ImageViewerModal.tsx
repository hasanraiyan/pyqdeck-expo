import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { ImageItem } from '../utils/imageGalleryParser';

interface ImageViewerModalProps {
  visible: boolean;
  images: ImageItem[];
  initialIndex?: number;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  images,
  initialIndex = 0,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [copied, setCopied] = useState(false);

  // Sync active index whenever modal opens
  React.useEffect(() => {
    if (visible) {
      setActiveIndex(Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1)));
      setCopied(false);
    }
  }, [visible, initialIndex, images.length]);

  const activeImage = images[activeIndex] || images[0];

  const handleCopy = async () => {
    if (!activeImage?.src) return;
    await Clipboard.setStringAsync(activeImage.src);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectTab = (idx: number) => {
    if (idx === activeIndex) return;
    Haptics.selectionAsync();
    setActiveIndex(idx);
  };

  // Pure HTML rendering the active image with high-performance pinch-to-zoom and pan
  const htmlContent = useMemo(() => {
    if (!visible || !activeImage?.src) return '';

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
      background: #0a0e14;
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
      align-items: center;
      justify-content: center;
    }
    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 4px;
      user-select: none;
      -webkit-user-select: none;
      transition: transform 0.2s ease-out;
    }
    .loading {
      color: #94a3b8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="wrapper">
    <img src="${activeImage.src}" alt="${activeImage.alt || 'Image'}" />
  </div>
</body>
</html>`;
  }, [visible, activeImage?.src, activeImage?.alt]);

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
        {/* Top Header */}
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={onClose}
              accessibilityLabel="Close image viewer"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="arrow-left" size={20} color="#f8fafc" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {images.length > 1
                  ? `IMAGE ${activeIndex + 1} OF ${images.length}`
                  : 'IMAGE PREVIEW'}
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
                color={copied ? COLORS.secondary : '#94a3b8'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Fullscreen Pinch-to-Zoom View */}
        <View style={styles.viewerWrapper}>
          <WebView
            originWhitelist={['*']}
            source={{ html: htmlContent }}
            style={styles.webView}
            scrollEnabled={true}
            bounces={true}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
          />
        </View>

        {/* Bottom thumbnail strip if multiple images */}
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
                      {img.alt ? (img.alt.length > 14 ? `${img.alt.substring(0, 12)}…` : img.alt) : `Fig ${idx + 1}`}
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
    backgroundColor: '#0a0e14',
  },
  headerContainer: {
    backgroundColor: 'rgba(10, 14, 20, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e293b',
    zIndex: 10,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    maxWidth: '90%',
  },
  viewerWrapper: {
    flex: 1,
    backgroundColor: '#0a0e14',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bottomBar: {
    backgroundColor: 'rgba(10, 14, 20, 0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1e293b',
    paddingTop: 10,
  },
  thumbnailStrip: {
    paddingHorizontal: 16,
    gap: 8,
  },
  thumbPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  thumbPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  thumbPillText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  thumbPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
