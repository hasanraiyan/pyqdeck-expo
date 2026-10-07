import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { ImageItem } from '../utils/imageGalleryParser';
import { ImageViewerModal } from './ImageViewerModal';

interface ImageGalleryBlockProps {
  images: ImageItem[];
}

type ExpoPriority = 'low' | 'normal' | 'high';

/**
 * Robust image tile with lazy loading (expo-image memory-disk cache +
 * load priority), loading indicator, and tap-to-retry error fallback.
 *
 * Layout fix: base container style comes FIRST so the caller's size style
 * (width/height 100%) wins. The previous `[style, styles.imageContainer]`
 * order let `position: relative` clobber `absoluteFill` and collapsed the
 * single-image card to zero height — the spinner ran forever.
 */
const SafeImageTile: React.FC<{
  src: string;
  alt?: string;
  style: StyleProp<ViewStyle>;
  contentFit?: 'contain' | 'cover';
  priority?: ExpoPriority;
}> = ({ src, alt, style, contentFit = 'cover', priority = 'normal' }) => {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  if (!src) return null;

  if (hasError) {
    return (
      <TouchableOpacity
        style={[styles.imageContainer, style, styles.errorContainer]}
        activeOpacity={0.7}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setRetryKey((k) => k + 1);
          setHasError(false);
          setLoading(true);
        }}
        accessibilityLabel="Retry loading image"
      >
        <Feather name="image" size={20} color={COLORS.textSubtle} />
        <Text style={styles.errorText} numberOfLines={1}>
          {alt || 'Image unavailable'}
        </Text>
        <View style={styles.retryPill}>
          <Feather name="refresh-cw" size={11} color={COLORS.primary} />
          <Text style={styles.retryText}>Tap to retry</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.imageContainer, style]}>
      <Image
        source={{ uri: src }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        transition={250}
        cachePolicy="memory-disk"
        priority={priority}
        recyclingKey={`${src}#${retryKey}`}
        allowDownscaling
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setHasError(true);
        }}
        accessibilityLabel={alt}
      />
      {loading && (
        <View style={styles.loadingContainer} pointerEvents="none">
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}
    </View>
  );
};

export const ImageGalleryBlock: React.FC<ImageGalleryBlockProps> = React.memo(({ images }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const openViewer = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIndex(index);
    setModalVisible(true);
  };

  const count = images.length;

  // 1. Single Image Layout (Full-width card with caption & tap-to-zoom)
  if (count === 1) {
    const img = images[0];
    return (
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openViewer(0)}
          style={styles.singleCard}
        >
          <View style={styles.singleImageWrapper}>
            <SafeImageTile
              src={img.src}
              alt={img.alt}
              style={styles.singleImageFill}
              contentFit="contain"
              priority="high"
            />
            <View style={styles.zoomBadge}>
              <Feather name="maximize-2" size={13} color={COLORS.text} />
            </View>
          </View>
          {Boolean(img.alt) && (
            <View style={styles.captionBar}>
              <Feather name="image" size={12} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.captionText} numberOfLines={2}>
                {img.alt}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <ImageViewerModal
          visible={modalVisible}
          images={images}
          initialIndex={selectedIndex}
          onClose={() => setModalVisible(false)}
        />
      </View>
    );
  }

  // 2. Dual Images (Side-by-Side 50 / 50 Comparison)
  if (count === 2) {
    return (
      <View style={styles.container}>
        <View style={styles.dualContainer}>
          {images.map((img, idx) => (
            <TouchableOpacity
              key={`dual-${idx}`}
              activeOpacity={0.85}
              onPress={() => openViewer(idx)}
              style={styles.dualCard}
            >
              <SafeImageTile
                src={img.src}
                alt={img.alt}
                style={styles.gridImageFill}
                priority={idx === 0 ? 'high' : 'low'}
              />
              <View style={styles.counterPill}>
                <Text style={styles.counterPillText}>{idx + 1}/2</Text>
              </View>
              {Boolean(img.alt) && (
                <View style={styles.miniCaption}>
                  <Text style={styles.miniCaptionText} numberOfLines={1}>
                    {img.alt}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <ImageViewerModal
          visible={modalVisible}
          images={images}
          initialIndex={selectedIndex}
          onClose={() => setModalVisible(false)}
        />
      </View>
    );
  }

  // 3. Exactly 3 Images (Hero 65% + 2 Stacked Sidekick Tiles 35%)
  if (count === 3) {
    return (
      <View style={styles.container}>
        <View style={styles.heroRow}>
          {/* Main Hero (Left) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openViewer(0)}
            style={styles.heroLeft}
          >
            <SafeImageTile
              src={images[0].src}
              alt={images[0].alt}
              style={styles.gridImageFill}
              priority="high"
            />
            <View style={styles.zoomBadge}>
              <Feather name="maximize-2" size={13} color={COLORS.text} />
            </View>
          </TouchableOpacity>

          {/* Right 2 Stacked Tiles */}
          <View style={styles.columnRight}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openViewer(1)}
              style={styles.columnTileHalf}
            >
              <SafeImageTile
                src={images[1].src}
                alt={images[1].alt}
                style={styles.gridImageFill}
                priority="low"
              />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openViewer(2)}
              style={styles.columnTileHalf}
            >
              <SafeImageTile
                src={images[2].src}
                alt={images[2].alt}
                style={styles.gridImageFill}
                priority="low"
              />
            </TouchableOpacity>
          </View>
        </View>

        <ImageViewerModal
          visible={modalVisible}
          images={images}
          initialIndex={selectedIndex}
          onClose={() => setModalVisible(false)}
        />
      </View>
    );
  }

  // 4. Exactly 4 Images (2x2 Symmetric Grid)
  if (count === 4) {
    return (
      <View style={styles.container}>
        <View style={styles.quadGrid}>
          {images.map((img, idx) => (
            <TouchableOpacity
              key={`quad-${idx}`}
              activeOpacity={0.85}
              onPress={() => openViewer(idx)}
              style={styles.quadTile}
            >
              <SafeImageTile
                src={img.src}
                alt={img.alt}
                style={styles.gridImageFill}
                priority={idx === 0 ? 'high' : 'low'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <ImageViewerModal
          visible={modalVisible}
          images={images}
          initialIndex={selectedIndex}
          onClose={() => setModalVisible(false)}
        />
      </View>
    );
  }

  // 5. 5 or More Images (User's Exact Sketch: Hero 65% + 3 Stacked Column Slots 35% with +N on bottom slot)
  const remainingCount = count - 3;

  return (
    <View style={styles.container}>
      <View style={styles.heroRow}>
        {/* Main Hero Preview (Left ~65%) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openViewer(0)}
          style={styles.heroLeft}
        >
          <SafeImageTile
            src={images[0].src}
            alt={images[0].alt}
            style={styles.gridImageFill}
            priority="high"
          />
          <View style={styles.zoomBadge}>
            <Feather name="maximize-2" size={13} color={COLORS.text} />
          </View>
        </TouchableOpacity>

        {/* Right Stacked Column (~35%) with 3 Slots */}
        <View style={styles.columnRight}>
          {/* Slot 1 (Top) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openViewer(1)}
            style={styles.columnTileThird}
          >
            <SafeImageTile
              src={images[1].src}
              alt={images[1].alt}
              style={styles.gridImageFill}
              priority="low"
            />
          </TouchableOpacity>

          {/* Slot 2 (Middle) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openViewer(2)}
            style={styles.columnTileThird}
          >
            <SafeImageTile
              src={images[2].src}
              alt={images[2].alt}
              style={styles.gridImageFill}
              priority="low"
            />
          </TouchableOpacity>

          {/* Slot 3 (Bottom with +N overlay) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openViewer(3)}
            style={styles.columnTileThird}
          >
            <SafeImageTile
              src={images[3].src}
              alt={images[3].alt}
              style={styles.gridImageFill}
              priority="low"
            />
            <View style={styles.overflowOverlay}>
              <Text style={styles.overflowText}>+{remainingCount}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Gallery footer bar */}
      <View style={styles.galleryFooter}>
        <Feather name="layers" size={12} color={COLORS.primary} style={{ marginRight: 6 }} />
        <Text style={styles.galleryFooterText}>
          {count} images • Tap any image to expand and swipe
        </Text>
      </View>

      <ImageViewerModal
        visible={modalVisible}
        images={images}
        initialIndex={selectedIndex}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    width: '100%',
  },
  // Single card styles
  singleCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  singleImageWrapper: {
    width: '100%',
    height: 220,
    backgroundColor: COLORS.cardSecondary,
    position: 'relative',
  },
  singleImageFill: {
    width: '100%',
    height: '100%',
  },
  imageContainer: {
    overflow: 'hidden',
    backgroundColor: COLORS.cardSecondary,
    position: 'relative',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  errorText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textSubtle,
    marginTop: 4,
  },
  retryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    gap: 4,
  },
  retryText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  zoomBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: 6,
  },
  captionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  captionText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONTS.mono,
    flex: 1,
  },

  // Dual layout (50/50)
  dualContainer: {
    flexDirection: 'row',
    gap: 6,
    height: 180,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  dualCard: {
    flex: 1,
    position: 'relative',
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  counterPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(27, 36, 48, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  counterPillText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
  },
  miniCaption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(27, 36, 48, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  miniCaptionText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: '#ffffff',
  },

  // Hero + Column layout (Cases 3 and 5+)
  heroRow: {
    flexDirection: 'row',
    gap: 6,
    height: 240,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  heroLeft: {
    flex: 0.65,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    position: 'relative',
    overflow: 'hidden',
  },
  columnRight: {
    flex: 0.35,
    gap: 6,
  },
  columnTileHalf: {
    flex: 1,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  columnTileThird: {
    flex: 1,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImageFill: {
    width: '100%',
    height: '100%',
  },

  // 2x2 Grid (Case 4)
  quadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    height: 240,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  quadTile: {
    width: '49%',
    flexGrow: 1,
    height: 117,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },

  // +N Overflow Overlay
  overflowOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(27, 36, 48, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    fontFamily: FONTS.mono,
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },

  // Footer bar for 5+ images
  galleryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  galleryFooterText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
