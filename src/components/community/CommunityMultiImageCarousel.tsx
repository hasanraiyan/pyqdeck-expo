import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';

interface CommunityMultiImageCarouselProps {
  images: { src: string; alt?: string }[];
  onOpenImage: (index: number) => void;
}

const CARD_HEIGHT = 290;
const GAP = 8;
const PADDING = 14;

export const CommunityMultiImageCarousel: React.FC<CommunityMultiImageCarouselProps> = ({
  images,
  onOpenImage,
}) => {
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width
  );
  const [activeIndex, setActiveIndex] = useState(0);

  // Card width is ~76% of available post width so the next image peeks from the right (like LinkedIn image.png)
  const cardWidth = Math.round((containerWidth - PADDING * 2) * 0.76);
  const snapInterval = cardWidth + GAP;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    if (snapInterval > 0) {
      const idx = Math.round(offsetX / snapInterval);
      const clamped = Math.max(0, Math.min(idx, images.length - 1));
      if (clamped !== activeIndex) {
        setActiveIndex(clamped);
      }
    }
  };

  return (
    <View
      style={styles.wrapper}
      onLayout={(e) => {
        const { width } = e.nativeEvent.layout;
        if (width > 0 && Math.abs(width - containerWidth) > 2) {
          setContainerWidth(width);
        }
      }}
    >
      <FlatList
        data={images}
        keyExtractor={(_, index) => `post-img-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: PADDING },
        ]}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate={Platform.OS === 'ios' ? 'normal' : 'fast'}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.92}
            style={[styles.imageCard, { width: cardWidth, height: CARD_HEIGHT }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onOpenImage(index);
            }}
          >
            <Image
              source={{ uri: item.src }}
              style={styles.cardImage}
              contentFit="cover"
              transition={200}
            />
          </TouchableOpacity>
        )}
      />

      {/* Floating Counter Pill (Top-Right, matching image.png 1/3 pill) */}
      {images.length > 1 && (
        <View style={styles.counterPill} pointerEvents="none">
          <Text style={styles.counterText}>
            {activeIndex + 1}/{images.length}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginVertical: 4,
    width: '100%',
  },
  listContent: {
    paddingVertical: 2,
  },
  imageCard: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  counterPill: {
    position: 'absolute',
    top: 14,
    right: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  counterText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
