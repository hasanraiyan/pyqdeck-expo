import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DetailsSpoilerBlockProps {
  summary: string;
  content: string;
  defaultOpen?: boolean;
}

export const DetailsSpoilerBlock: React.FC<DetailsSpoilerBlockProps> = React.memo(({
  summary,
  content,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsOpen((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.header, isOpen && styles.headerOpen]}
        activeOpacity={0.75}
        onPress={toggleOpen}
        accessibilityRole="button"
        accessibilityLabel={`Toggle hint: ${summary}`}
        accessibilityState={{ expanded: isOpen }}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, isOpen && styles.iconBadgeOpen]}>
            <Feather
              name={isOpen ? 'unlock' : 'help-circle'}
              size={14}
              color={isOpen ? COLORS.primary : COLORS.secondary}
            />
          </View>
          <Text style={styles.summaryText} numberOfLines={2}>
            {summary}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.toggleHintText}>
            {isOpen ? 'Hide' : 'Reveal'}
          </Text>
          <Feather
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.textMuted}
            style={{ marginLeft: 4 }}
          />
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.contentWrap}>
          <Markdown style={solutionMarkdownStyles} rules={markdownRules}>
            {content}
          </Markdown>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.cardSecondary,
  },
  headerOpen: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconBadgeOpen: {
    backgroundColor: COLORS.primaryLight,
  },
  summaryText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.2,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    fontFamily: FONTS.mono,
    letterSpacing: 0.3,
  },
  contentWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
  },
});
