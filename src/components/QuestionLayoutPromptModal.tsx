import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { useDialogLayout } from '../utils/dialog';
import { useResponsive } from '../utils/responsive';
import { MarksBadge, YearBadge, QNumBadge } from './Badge';

interface QuestionLayoutPromptModalProps {
  visible: boolean;
  onSelect: (isCards: boolean) => void;
}

const SolutionCta: React.FC = () => (
  <View style={styles.mockCtaLink}>
    <Feather name="check-circle" size={13} color={COLORS.secondary} />
    <Text style={styles.mockCtaText} numberOfLines={1}>
      Solution available
      {' \u00b7 '}<Text style={styles.mockCtaUnderline}>View details</Text>
    </Text>
    <Feather name="arrow-right" size={13} color={COLORS.secondary} />
  </View>
);

/** Static stand-in for QuestionItem: one collapsed row, one expanded row. */
const AccordionMock: React.FC = () => (
  <View style={styles.sampleWrapper} pointerEvents="none">
    <Text style={styles.sampleKicker}>PREVIEW</Text>
    <View style={styles.mockBox}>
      <View style={styles.mockRow}>
        <Text style={styles.mockRowText} numberOfLines={1}>
          <Text style={styles.mockQNum}>Q1. </Text>
          Explain preemptive vs non-preemptive scheduling
        </Text>
        <YearBadge year={2024} />
        <MarksBadge marks={5} />
        <Feather name="chevron-down" size={16} color={COLORS.textMuted} />
      </View>
      <View style={[styles.mockRow, styles.mockRowOpen]}>
        <Text style={styles.mockRowText} numberOfLines={1}>
          <Text style={styles.mockQNum}>Q2. </Text>
          What is virtual memory?
        </Text>
        <MarksBadge marks={4} />
        <Feather name="chevron-up" size={16} color={COLORS.primary} />
      </View>
      <View style={styles.mockExpandedBody}>
        <Text style={styles.mockBody} numberOfLines={2}>
          Describe the concept of paging with a neat diagram.
        </Text>
        <SolutionCta />
      </View>
    </View>
  </View>
);

/** Static stand-in for QuestionItemClassic: an always-open card. */
const CardMock: React.FC = () => (
  <View style={styles.sampleWrapper} pointerEvents="none">
    <Text style={styles.sampleKicker}>PREVIEW</Text>
    <View style={styles.mockCard}>
      <View style={styles.mockMetaRow}>
        <YearBadge year={2024} variant="teal" />
        <View style={styles.mockMetaRight}>
          <QNumBadge qNum="Q1" variant="primary" />
          <MarksBadge marks={5} />
        </View>
      </View>
      <View style={styles.mockModuleStrip}>
        <Feather name="layers" size={12} color={COLORS.primary} />
        <Text style={styles.mockModuleText} numberOfLines={1}>
          Module 1 · Process Management
        </Text>
      </View>
      <Text style={styles.mockBody} numberOfLines={3}>
        Explain the difference between preemptive and non-preemptive CPU scheduling with
        suitable examples.
      </Text>
      <SolutionCta />
    </View>
  </View>
);

export const QuestionLayoutPromptModal: React.FC<QuestionLayoutPromptModalProps> = ({
  visible,
  onSelect,
}) => {
  const dlg = useDialogLayout();
  const { width } = useResponsive();
  const [selectedMode, setSelectedMode] = useState<'accordion' | 'cards'>('accordion');

  // Tablet-width sheets would otherwise stretch edge to edge; cap and centre.
  const capped = !dlg.wide && width > 600;
  const sheetWidth = capped ? { width: '100%' as const, maxWidth: 560, alignSelf: 'center' as const } : null;

  const handleSelectMode = (mode: 'accordion' | 'cards') => {
    Haptics.selectionAsync();
    setSelectedMode(mode);
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelect(selectedMode === 'cards');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={dlg.animationType}
      onRequestClose={handleConfirm}
    >
      <TouchableWithoutFeedback onPress={handleConfirm}>
        <View style={[styles.overlay, dlg.overlay]}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, dlg.sheet, sheetWidth]}>
              <View style={styles.handle} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.scrollContent}
              >
                <Text style={styles.title}>Choose Reading Layout</Text>
                <Text style={styles.subtitle}>
                  Select how you would like to browse exam question papers:
                </Text>

                {/* 1. Accordion */}
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    selectedMode === 'accordion' && styles.optionCardActive,
                  ]}
                  activeOpacity={0.78}
                  onPress={() => handleSelectMode('accordion')}
                >
                  <View style={styles.optionHeader}>
                    <View style={styles.optionHeaderLeft}>
                      <View
                        style={[
                          styles.iconBox,
                          selectedMode === 'accordion' && styles.iconBoxActive,
                        ]}
                      >
                        <Feather
                          name="list"
                          size={15}
                          color={
                            selectedMode === 'accordion' ? COLORS.primary : COLORS.textMuted
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.titleRow}>
                          <Text
                            style={[
                              styles.optionTitle,
                              selectedMode === 'accordion' && styles.optionTitleActive,
                            ]}
                          >
                            Accordion
                          </Text>
                          <View style={styles.recommendedBadge}>
                            <Text style={styles.recommendedBadgeText}>Default</Text>
                          </View>
                        </View>
                        <Text style={styles.optionSubtitle}>
                          Compact list. Tap any question to expand.
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        selectedMode === 'accordion' && styles.radioCircleActive,
                      ]}
                    >
                      {selectedMode === 'accordion' && <View style={styles.radioDot} />}
                    </View>
                  </View>
                  <AccordionMock />
                </TouchableOpacity>

                {/* 2. Open Cards */}
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    selectedMode === 'cards' && styles.optionCardActive,
                  ]}
                  activeOpacity={0.78}
                  onPress={() => handleSelectMode('cards')}
                >
                  <View style={styles.optionHeader}>
                    <View style={styles.optionHeaderLeft}>
                      <View
                        style={[
                          styles.iconBox,
                          selectedMode === 'cards' && styles.iconBoxActive,
                        ]}
                      >
                        <Feather
                          name="layout"
                          size={15}
                          color={selectedMode === 'cards' ? COLORS.primary : COLORS.textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.optionTitle,
                            selectedMode === 'cards' && styles.optionTitleActive,
                          ]}
                        >
                          Open Cards
                        </Text>
                        <Text style={styles.optionSubtitle}>
                          Continuous reading. Questions are open.
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        selectedMode === 'cards' && styles.radioCircleActive,
                      ]}
                    >
                      {selectedMode === 'cards' && <View style={styles.radioDot} />}
                    </View>
                  </View>
                  <CardMock />
                </TouchableOpacity>

                <Text style={styles.footerHint}>
                  You can change this anytime from the Settings screen.
                </Text>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleConfirm}
                  activeOpacity={0.82}
                >
                  <Text style={styles.confirmBtnText}>Continue</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 26,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  optionCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 13,
    marginBottom: 14,
  },
  optionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(178, 58, 46, 0.03)',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  optionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: 'rgba(178, 58, 46, 0.08)',
    borderColor: COLORS.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  optionTitleActive: {
    color: COLORS.primary,
  },
  recommendedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: 'rgba(178, 58, 46, 0.08)',
  },
  recommendedBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  optionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioCircleActive: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  sampleWrapper: {
    marginTop: 4,
  },
  sampleKicker: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  mockBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.card,
  },
  mockRowOpen: {
    backgroundColor: COLORS.background,
  },
  mockRowText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: COLORS.text,
  },
  mockQNum: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  mockExpandedBody: {
    padding: 12,
    backgroundColor: COLORS.background,
  },
  mockCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 12,
    gap: 10,
  },
  mockMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mockMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  mockModuleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mockModuleText: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  mockBody: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.text,
  },
  mockCtaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 6,
  },
  mockCtaText: {
    flexShrink: 1,
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  mockCtaUnderline: {
    textDecorationLine: 'underline',
  },
  footerHint: {
    fontSize: 11.5,
    color: COLORS.textSubtle,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
