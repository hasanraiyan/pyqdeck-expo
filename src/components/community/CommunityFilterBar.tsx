import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';

interface CommunityFilterBarProps {
  selectedHashtag: string | null;
  onSelectHashtag: (tag: string | null) => void;
  trendingHashtags: string[];
}

export const CommunityFilterBar: React.FC<CommunityFilterBarProps> = ({
  selectedHashtag,
  onSelectHashtag,
  trendingHashtags,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hashtagScroll}
      >
        {/* All Posts pill */}
        <TouchableOpacity
          style={[styles.tagPill, selectedHashtag === null && styles.tagPillSelected]}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onSelectHashtag(null);
          }}
        >
          <Feather
            name="grid"
            size={12}
            color={selectedHashtag === null ? '#ffffff' : COLORS.textMuted}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.tagPillText, selectedHashtag === null && styles.tagPillTextSelected]}>
            All
          </Text>
        </TouchableOpacity>

        {/* Selected Hashtag pill if active and not in trending */}
        {selectedHashtag && !trendingHashtags.map(t => t.toLowerCase()).includes(selectedHashtag.toLowerCase()) && (
          <TouchableOpacity
            style={[styles.tagPill, styles.tagPillSelected]}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onSelectHashtag(null);
            }}
          >
            <Text style={[styles.tagPillText, styles.tagPillTextSelected]}>
              #{selectedHashtag}
            </Text>
            <Feather name="x" size={11} color="#ffffff" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        )}

        {/* Trending Hashtags */}
        {trendingHashtags.map((tag) => {
          const isSelected = selectedHashtag?.toLowerCase() === tag.toLowerCase();
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.tagPill, isSelected && styles.tagPillSelected]}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onSelectHashtag(isSelected ? null : tag);
              }}
            >
              <Text style={[styles.tagPillText, isSelected && styles.tagPillTextSelected]}>
                #{tag}
              </Text>
              {isSelected && (
                <Feather name="x" size={11} color="#ffffff" style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  hashtagScroll: {
    paddingHorizontal: 16,
    gap: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagPillSelected: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  tagPillText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  tagPillTextSelected: {
    color: '#ffffff',
  },
});
