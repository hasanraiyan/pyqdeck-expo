import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { WebView } from './WebViewCompat';
import { COLORS, FONTS } from '../theme/colors';
import { usePreventScreenCapture } from '../utils/screenCapture';
import {
  getPlaceholderPaper,
  type PlaceholderPage,
} from '../utils/originalPaperPlaceholder';

/**
 * Paper-level viewer for one year's original scanned paper
 * (docs/SRS-original-paper-viewer.md).
 *
 * Rendered as a fullscreen modal INSIDE the question list screen - it has no
 * route and no navigation header of its own, only this in-modal top bar.
 *
 * UI-first build: pages come from the temporary placeholder provider (a sample
 * scan URL). The protections are real already: capture blocking while mounted,
 * no save/share affordance, long-press menu disabled, identity watermark on
 * every page, memory-only image caching.
 *
 * Deliberately ad-free and chrome-light: no banner, no extra buttons.
 */

const zoomHtml = (src: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <style>
    * { box-sizing: border-box; -webkit-touch-callout: none !important; user-select: none !important; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #f5f6f2; }
    body { display: flex; align-items: center; justify-content: center; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; }
  </style>
</head>
<body>
  <img src="${src.replace(/"/g, '&quot;')}" />
  <script>
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);
  </script>
</body>
</html>`;

/** Diagonal identity tile that scrolls with the page (never a fixed header). */
const Watermark = ({ text }: { text: string }) => {
  const line = useMemo(() => Array(6).fill(text).join('  ·  '), [text]);
  return (
    <View pointerEvents="none" style={styles.watermark}>
      {Array.from({ length: 9 }, (_, i) => (
        <Text key={i} style={styles.watermarkText} numberOfLines={1}>
          {line}
        </Text>
      ))}
    </View>
  );
};

export const OriginalPaperViewer = ({
  subjectId,
  year,
  onClose,
}: {
  subjectId: string;
  year: number;
  onClose: () => void;
}) => {
  // Blocks screenshots + screen recordings while this viewer is mounted;
  // silent no-op on builds without the native module (viewer still opens).
  usePreventScreenCapture('original-paper');

  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const identity = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Preview copy';

  const pages: PlaceholderPage[] = useMemo(
    () => getPlaceholderPaper(String(subjectId ?? ''), Number(year ?? 0)),
    [subjectId, year]
  );

  const [visiblePage, setVisiblePage] = useState(1);
  const [zoomed, setZoomed] = useState<PlaceholderPage | null>(null);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [retryTick, setRetryTick] = useState(0);
  // FlatList demands exactly one threshold key in viewabilityConfig, and a
  // stable callback identity - both held in refs so they never change.
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems?.[0]?.index;
    if (typeof first === 'number') setVisiblePage(first + 1);
  });

  const retryPage = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFailed((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setRetryTick((t) => t + 1);
  }, []);

  const openZoom = useCallback((page: PlaceholderPage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setZoomed(page);
  }, []);

  const renderPage = useCallback(
    ({ item }: { item: PlaceholderPage }) => {
      const isFailed = failed.has(item.index);
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => openZoom(item)}
          // No long-press handler on purpose: nothing to save through.
          delayLongPress={800}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Page ${item.index + 1}, tap to zoom`}
        >
          <View style={styles.pageFrame}>
            {isFailed ? (
              <TouchableOpacity
                style={styles.pageError}
                activeOpacity={0.7}
                onPress={() => retryPage(item.index)}
              >
                <Feather name="refresh-cw" size={18} color={COLORS.textMuted} />
                <Text style={styles.pageErrorText}>Could not load page {item.index + 1}. Tap to retry.</Text>
              </TouchableOpacity>
            ) : (
              <Image
                key={`${item.url}-${retryTick}`}
                source={{ uri: item.url }}
                style={styles.pageImage}
                contentFit="contain"
                // Memory only: pages must never land in a user-visible cache.
                cachePolicy="memory"
                onError={() =>
                  setFailed((prev) => new Set(prev).add(item.index))
                }
              />
            )}
            <Watermark text={identity} />
          </View>
        </TouchableOpacity>
      );
    },
    [failed, identity, openZoom, retryPage, retryTick]
  );

  return (
    <View style={styles.container}>
      {/* In-viewer top bar in the app's own header language (no nav header). */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          activeOpacity={0.7}
          onPress={onClose}
          accessibilityLabel="Close original paper"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {year} Paper · Original
          </Text>
          <Text style={styles.subtitle}>
            Page {visiblePage} of {pages.length}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          activeOpacity={0.7}
          onPress={onClose}
          accessibilityLabel="Close original paper"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={pages}
        keyExtractor={(p) => `page-${p.index}`}
        renderItem={renderPage}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged.current}
      />

      {/* Pinch-to-zoom fullscreen: WebView for native zoom, context menu off,
          no copy/share buttons anywhere. Watermark stays on top. */}
      <Modal
        visible={zoomed !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setZoomed(null)}
      >
        <View style={styles.zoomRoot}>
          {zoomed && (
            <WebView
              source={{ html: zoomHtml(zoomed.url) }}
              style={styles.zoomWeb}
              // No file access, no JS bridges, no new windows: pure zoom surface.
              allowFileAccess={false}
              allowUniversalAccessFromFileURLs={false}
              allowFileAccessFromFileURLs={false}
              javaScriptEnabled
              domStorageEnabled={false}
              mediaPlaybackRequiresUserAction
              setSupportMultipleWindows={false}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.zoomLoading}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              )}
            />
          )}
          <Watermark text={identity} />
          <TouchableOpacity
            style={[styles.zoomClose, { top: insets.top + 10, right: 12 }]}
            activeOpacity={0.7}
            onPress={() => setZoomed(null)}
            accessibilityLabel="Close zoomed page"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1, gap: 1 },
  title: { fontFamily: FONTS.displayBold, fontSize: 16, color: COLORS.text },
  subtitle: { fontFamily: FONTS.bodyMedium, fontSize: 11.5, color: COLORS.textMuted },
  list: { paddingTop: 10, gap: 8, paddingHorizontal: 8 },
  pageFrame: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    aspectRatio: 800 / 1130,
  },
  pageImage: { width: '100%', height: '100%' },
  pageError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  pageErrorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12.5,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  watermark: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  watermarkText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.primary,
    opacity: 0.22,
    transform: [{ rotate: '-28deg' }],
    width: '140%',
    textAlign: 'center',
  },
  zoomRoot: { flex: 1, backgroundColor: COLORS.background },
  zoomWeb: { flex: 1, backgroundColor: COLORS.background },
  zoomLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  zoomClose: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
