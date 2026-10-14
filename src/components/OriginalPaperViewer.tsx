import React, { useCallback, useRef, useState } from 'react';
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
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { WebView } from './WebViewCompat';
import { AdBanner } from './AdBanner';
import { COLORS, FONTS } from '../theme/colors';
import { usePreventScreenCapture } from '../utils/screenCapture';
import { zoomHtml } from '../utils/imageZoom';
import type { PaperViewerPage } from '../api';

/**
 * Paper-level viewer for one year's original scanned paper
 * (docs/SRS-original-paper-viewer.md).
 *
 * Rendered as a headerless route with its own top bar. Pages arrive resolved
 * (signed server URLs, or the dev placeholder) via props - this component
 * never fetches. The protections: capture blocking while mounted, no
 * save/share affordance, long-press menu disabled, memory-only image caching.
 *
 * Chrome-light: no extra buttons. A bottom banner sits under the page list and
 * under the zoom panel (hidden when ads are gated off); zoom is pinch, drag and
 * double-tap, handled in utils/imageZoom.ts.
 */

export const OriginalPaperViewer = ({
  year,
  pages,
  onClose,
}: {
  year: number;
  pages: PaperViewerPage[];
  onClose: () => void;
}) => {
  // Blocks screenshots + screen recordings while this viewer is mounted;
  // silent no-op on builds without the native module (viewer still opens).
  usePreventScreenCapture('original-paper');

  const insets = useSafeAreaInsets();

  const [visiblePage, setVisiblePage] = useState(1);
  const [zoomed, setZoomed] = useState<PaperViewerPage | null>(null);
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

  const openZoom = useCallback((page: PaperViewerPage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setZoomed(page);
  }, []);

  const aspectOf = (page: PaperViewerPage) =>
    page.width && page.height ? page.width / page.height : 800 / 1130;

  const renderPage = useCallback(
    ({ item, index }: { item: PaperViewerPage; index: number }) => {
      const isFailed = failed.has(index);
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => openZoom(item)}
          // No long-press handler on purpose: nothing to save through.
          delayLongPress={800}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Page ${index + 1}, tap to zoom`}
        >
          <View style={[styles.pageFrame, { aspectRatio: aspectOf(item) }]}>
            {isFailed ? (
              <TouchableOpacity
                style={styles.pageError}
                activeOpacity={0.7}
                onPress={() => retryPage(index)}
              >
                <Feather name="refresh-cw" size={18} color={COLORS.textMuted} />
                <Text style={styles.pageErrorText}>Could not load page {index + 1}. Tap to retry.</Text>
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
                  setFailed((prev) => new Set(prev).add(index))
                }
              />
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [failed, openZoom, retryPage, retryTick]
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
        keyExtractor={(_, i) => `page-${i}`}
        renderItem={renderPage}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged.current}
      />

      {/* Bottom banner, same as every content screen (hidden when gated off). */}
      <AdBanner />

      {/* Pinch-to-zoom fullscreen: WebView for native zoom, context menu off,
          no copy/share buttons anywhere. */}
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
          {/* Bottom banner in zoom too (hidden when gated off). */}
          <AdBanner />
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
