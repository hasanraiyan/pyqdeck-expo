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
import { QuestionItem } from './QuestionItem';
import { QuestionItemClassic } from './QuestionItemClassic';
import { QuestionSummary } from '../types';

interface QuestionLayoutPromptModalProps {
  visible: boolean;
  onSelect: (isCards: boolean) => void;
}

const DEMO_QUESTION: QuestionSummary = {
  questionId: 'demo-layout-q1',
  year: 2024,
  qNumber: 'Q1',
  chapter: 'MODULE 1 · PROCESS MANAGEMENT',
  text: 'Explain the difference between **preemptive** and **non-preemptive** CPU scheduling with suitable examples.',
  textPreview: 'Explain the difference between preemptive and non-preemptive CPU scheduling...',
  textHtml: '',
  type: 'theory',
  marks: 5,
  hasSolution: true,
};

const DEMO_QUESTION_2: QuestionSummary = {
  questionId: 'demo-layout-q2',
  year: 2024,
  qNumber: 'Q2',
  chapter: 'MODULE 1 · PROCESS MANAGEMENT',
  text: 'What is **virtual memory**? Describe the concept of paging with a neat diagram.',
  textPreview: 'What is virtual memory? Describe the concept of paging with a neat diagram...',
  textHtml: '',
  type: 'theory',
  marks: 4,
  hasSolution: false,
};

export const QuestionLayoutPromptModal: React.FC<QuestionLayoutPromptModalProps> = ({
  visible,
  onSelect,
}) => {
  const dlg = useDialogLayout();
  const [selectedMode, setSelectedMode] = useState<'accordion' | 'cards'>('accordion');

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
            <View style={[styles.sheet, dlg.sheet]}>
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

                {/* 1. Accordion Option Card with Real Component */}
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
                            selectedMode === 'accordion'
                              ? COLORS.primary
                              : COLORS.textMuted
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.titleRow}>
                          <Text
                            style={[
                              styles.optionTitle,
                              selectedMode === 'accordion' &&
                                styles.optionTitleActive,
                            ]}
                          >
                            Accordion
                          </Text>
                          <View style={styles.recommendedBadge}>
                            <Text style={styles.recommendedBadgeText}>
                              Default
                            </Text>
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
                      {selectedMode === 'accordion' && (
                        <View style={styles.radioDot} />
                      )}
                    </View>
                  </View>

                  {/* Real QuestionItem component preview */}
                  <View style={styles.sampleWrapper} pointerEvents="none">
                    <View style={styles.sampleHeaderStrip}>
                      <Text style={styles.sampleKicker}>LIVE PREVIEW</Text>
                    </View>
                    <View style={styles.realAccordionBox}>
                      <QuestionItem
                        question={DEMO_QUESTION}
                        subjectId="demo"
                        semesterId="3"
                        compact
                        style={styles.realAccordionRow}
                      />
                      <QuestionItem
                        question={DEMO_QUESTION_2}
                        subjectId="demo"
                        semesterId="3"
                        compact
                        style={styles.realAccordionRow}
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* 2. Open Cards Option Card with Real Component */}
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
                          color={
                            selectedMode === 'cards'
                              ? COLORS.primary
                              : COLORS.textMuted
                          }
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
                      {selectedMode === 'cards' && (
                        <View style={styles.radioDot} />
                      )}
                    </View>
                  </View>

                  {/* Real QuestionItemClassic component preview */}
                  <View style={styles.sampleWrapper} pointerEvents="none">
                    <View style={styles.sampleHeaderStrip}>
                      <Text style={styles.sampleKicker}>LIVE PREVIEW</Text>
                    </View>
                    <QuestionItemClassic
                      question={DEMO_QUESTION}
                      subjectId="demo"
                      semesterId="3"
                      style={styles.realCardItem}
                    />
                  </View>
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
  sampleHeaderStrip: {
    marginBottom: 5,
  },
  sampleKicker: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 0.6,
  },
  realAccordionBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  realAccordionRow: {
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
  },
  realCardItem: {
    marginHorizontal: 0,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
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
