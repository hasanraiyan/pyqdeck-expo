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
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { FaqItem } from '../utils/faqParser';
import { NativeContentRenderer } from './NativeContentRenderer';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface FaqAccordionProps {
  items: FaqItem[];
  title?: string;
}

export const FaqAccordion: React.FC<FaqAccordionProps> = ({
  items,
  title = 'FREQUENTLY ASKED QUESTIONS',
}) => {
  // Set of currently expanded FAQ item indices
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(() => new Set());

  if (!items || items.length === 0) {
    return null;
  }

  const toggleItem = (index: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (expandedIndices.size === items.length) {
      setExpandedIndices(new Set());
    } else {
      setExpandedIndices(new Set(items.map((_, i) => i)));
    }
  };

  const allOpen = expandedIndices.size === items.length;

  return (
    <View style={styles.container}>
      {/* Accordion Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <Feather name="help-circle" size={14} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{items.length}</Text>
          </View>
        </View>

        {items.length > 1 && (
          <TouchableOpacity
            style={styles.toggleAllBtn}
            onPress={toggleAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={allOpen ? 'Collapse all FAQs' : 'Expand all FAQs'}
          >
            <Text style={styles.toggleAllText}>{allOpen ? 'Collapse all' : 'Expand all'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Accordion Cards */}
      <View style={styles.card}>
        {items.map((item, index) => {
          const isExpanded = expandedIndices.has(index);
          const isLast = index === items.length - 1;

          return (
            <View key={index} style={[styles.itemContainer, !isLast && styles.itemBorder]}>
              {/* Question Row (Clickable) */}
              <TouchableOpacity
                style={styles.questionRow}
                onPress={() => toggleItem(index)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                accessibilityLabel={`Question: ${item.question}`}
              >
                <View style={styles.qIndicator}>
                  <Text style={styles.qIndicatorText}>Q</Text>
                </View>

                <Text style={[styles.questionText, isExpanded && styles.questionTextExpanded]}>
                  {item.question}
                </Text>

                <View style={[styles.chevronWrap, isExpanded && styles.chevronWrapExpanded]}>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={isExpanded ? COLORS.primary : COLORS.textMuted}
                  />
                </View>
              </TouchableOpacity>

              {/* Answer Content (Revealed on expand) */}
              {isExpanded && (
                <View style={styles.answerWrapper}>
                  <NativeContentRenderer content={item.answer} fontSize={15} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginBottom: 16,
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 11.5,
    color: COLORS.text,
    letterSpacing: 0.6,
  },
  badge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    color: COLORS.primary,
  },
  toggleAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  toggleAllText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  itemContainer: {
    overflow: 'hidden',
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    gap: 10,
  },
  qIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qIndicatorText: {
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    color: COLORS.primary,
  },
  questionText: {
    flex: 1,
    fontFamily: FONTS.bodySemi,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  questionTextExpanded: {
    color: COLORS.primary,
  },
  chevronWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronWrapExpanded: {
    transform: [{ scale: 1.05 }],
  },
  answerWrapper: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 14,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight || '#f1f5f9',
  },
});
