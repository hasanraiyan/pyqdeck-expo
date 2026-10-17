import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import { CommunityAttachment } from '../../types/community';

interface CommunityDocumentSlideProps {
  attachment: CommunityAttachment;
  onOpenFullscreen: (initialPage: number) => void;
}

export const CommunityDocumentSlide: React.FC<CommunityDocumentSlideProps> = ({
  attachment,
  onOpenFullscreen,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - 24
  );
  const scrollViewRef = useRef<ScrollView>(null);

  const pages: string[] =
    attachment.previewPages && attachment.previewPages.length > 0
      ? attachment.previewPages
      : attachment.thumbnailUrl
      ? [attachment.thumbnailUrl]
      : [];

  const totalPages = attachment.pageCount || pages.length || 1;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    if (containerWidth > 0) {
      const page = Math.round(offsetX / containerWidth) + 1;
      const clamped = Math.max(1, Math.min(page, pages.length));
      if (clamped !== currentPage) {
        setCurrentPage(clamped);
      }
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      Haptics.selectionAsync().catch(() => {});
      const targetIndex = currentPage - 2;
      scrollViewRef.current?.scrollTo({ x: targetIndex * containerWidth, animated: true });
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < pages.length) {
      Haptics.selectionAsync().catch(() => {});
      const targetIndex = currentPage;
      scrollViewRef.current?.scrollTo({ x: targetIndex * containerWidth, animated: true });
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <View
      style={styles.cardContainer}
      onLayout={(e) => {
        const { width } = e.nativeEvent.layout;
        if (width > 0 && Math.abs(width - containerWidth) > 2) {
          setContainerWidth(width);
        }
      }}
    >
      {/* Slide Carousel */}
      <View style={styles.carouselContainer}>
        {pages.length > 0 ? (
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={32}
          >
            {pages.map((item, index) => (
              <TouchableOpacity
                key={`doc-page-${index}`}
                activeOpacity={0.94}
                style={[styles.pageSlide, { width: containerWidth }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  onOpenFullscreen(index);
                }}
              >
                <Image
                  source={{ uri: item }}
                  style={styles.slideImage}
                  contentFit="contain"
                  transition={200}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity
            style={styles.placeholderContainer}
            activeOpacity={0.9}
            onPress={() => onOpenFullscreen(0)}
          >
            <View style={styles.placeholderIconCircle}>
              <Feather name="file-text" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.placeholderTitle}>{attachment.name || 'Document'}</Text>
            <Text style={styles.placeholderSubtitle}>Tap to open document</Text>
          </TouchableOpacity>
        )}

        {/* Floating Page Counter Pill (Top-Right) */}
        {totalPages > 1 && (
          <View style={styles.pagePill}>
            <Text style={styles.pagePillText}>
              {currentPage} / {totalPages}
            </Text>
          </View>
        )}

        {/* Left Arrow Button */}
        {currentPage > 1 && (
          <TouchableOpacity
            style={[styles.navArrowBtn, styles.navArrowLeft]}
            onPress={handlePrevPage}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Previous slide"
          >
            <Feather name="chevron-left" size={20} color="#ffffff" />
          </TouchableOpacity>
        )}

        {/* Right Arrow Button */}
        {currentPage < pages.length && (
          <TouchableOpacity
            style={[styles.navArrowBtn, styles.navArrowRight]}
            onPress={handleNextPage}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Next slide"
          >
            <Feather name="chevron-right" size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Document Footer Bar (LinkedIn document post footer) */}
      <TouchableOpacity
        style={styles.footerBar}
        activeOpacity={0.85}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onOpenFullscreen(currentPage - 1);
        }}
      >
        <View style={styles.pdfBadge}>
          <Feather name="file-text" size={16} color="#ffffff" />
        </View>

        <View style={styles.footerInfo}>
          <Text style={styles.footerTitle} numberOfLines={1}>
            {attachment.name || 'Document.pdf'}
          </Text>
          <Text style={styles.footerSubtitle}>
            {totalPages} {totalPages === 1 ? 'page' : 'pages'}
            {attachment.size ? ` • ${attachment.size}` : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onOpenFullscreen(currentPage - 1);
          }}
          accessibilityLabel="Open fullscreen document"
        >
          <Feather name="maximize-2" size={16} color={COLORS.textSubtle} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 0,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#0a0a0c',
    overflow: 'hidden',
  },
  carouselContainer: {
    position: 'relative',
    height: 360,
    backgroundColor: '#111215',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageSlide: {
    height: 360,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111215',
  },
  slideImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111215',
  },
  placeholderContainer: {
    height: 320,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  placeholderTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  pagePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pagePillText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  navArrowBtn: {
    position: 'absolute',
    top: '46%',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  navArrowLeft: {
    left: 10,
  },
  navArrowRight: {
    right: 10,
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  pdfBadge: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  footerInfo: {
    flex: 1,
    marginRight: 8,
  },
  footerTitle: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13.5,
    color: COLORS.text,
  },
  footerSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  expandButton: {
    padding: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: '#edf2f7',
  },
});
