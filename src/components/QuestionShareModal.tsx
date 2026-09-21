import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { COLORS, FONTS } from '../theme/colors';
import { YearBadge, MarksBadge } from './Badge';
import { buildQuestionUrl, shareQuestion } from '../utils/links';
import { rf } from '../utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface QuestionShareData {
  questionId: string;
  text: string;
  year?: number | string;
  qNumber?: string;
  marks?: number | null;
  chapter?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  question: QuestionShareData | null;
  subjectName?: string;
  semesterId: string;
  subjectId: string;
}

export const QuestionShareModal: React.FC<Props> = ({
  visible,
  onClose,
  question,
  subjectName,
  semesterId,
  subjectId,
}) => {
  const cardRef = useRef<View>(null);
  const [sharingImage, setSharingImage] = useState(false);

  if (!question) return null;

  const url = buildQuestionUrl(semesterId, subjectId, question.year || '', question.questionId);

  // Clean raw markdown syntax for clean card presentation
  const cleanText = (question.text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#+\s*/g, '')
    .trim();

  const handleShareImage = async () => {
    if (!cardRef.current || sharingImage) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSharingImage(true);

      // Snapshot the rendered question card to a high-res PNG
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Share ${question.qNumber || 'Question'} - PyQdeck`,
          UTI: 'public.png',
        });
      } else {
        // Fallback to text if file sharing is unavailable
        await shareQuestion({
          subjectName,
          year: question.year,
          qNumber: question.qNumber,
          marks: question.marks,
          text: question.text,
          semesterId,
          subjectId,
          questionId: question.questionId,
        });
      }
    } catch (err) {
      console.warn('Failed to capture and share card image:', err);
    } finally {
      setSharingImage(false);
      onClose();
    }
  };

  const handleShareText = async () => {
    Haptics.selectionAsync();
    onClose();
    await shareQuestion({
      subjectName,
      year: question.year,
      qNumber: question.qNumber,
      marks: question.marks,
      text: question.text,
      semesterId,
      subjectId,
      questionId: question.questionId,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogContainer}>
          {/* Dialog Header */}
          <View style={styles.dialogHeader}>
            <View style={styles.dialogTitleWrap}>
              <Feather name="share-2" size={16} color={COLORS.primary} />
              <Text style={styles.dialogTitle}>Share Question Card</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <Feather name="x" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Card Preview */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.cardPreviewScroll}
          >
            {/* The Actual Capturable Question Card */}
            <View ref={cardRef} collapsable={false} style={styles.shareCard}>
              {/* Card Brand Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardBrand}>
                  <Text style={styles.cardLogoText}>PYQDECK</Text>
                  <View style={styles.brandDot} />
                  <Text style={styles.cardUniText}>BEU PREVIOUS YEAR</Text>
                </View>
                <Text style={styles.cardSemKicker}>SEM {semesterId?.replace(/\D/g, '') || ''}</Text>
              </View>

              {/* Subject Title */}
              <Text style={styles.cardSubjectTitle} numberOfLines={1}>
                {subjectName || 'Engineering Subject'}
              </Text>

              {/* Badges Row */}
              <View style={styles.cardBadgesRow}>
                {question.year ? (
                  <YearBadge year={question.year} variant="teal" />
                ) : null}

                {question.qNumber ? (
                  <View style={styles.qNumPill}>
                    <Text style={styles.qNumText}>{question.qNumber}</Text>
                  </View>
                ) : null}

                {question.marks ? (
                  <MarksBadge marks={question.marks} />
                ) : null}

                {question.chapter ? (
                  <View style={styles.chapterPill}>
                    <Text style={styles.chapterText} numberOfLines={1}>
                      {question.chapter.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Question Text */}
              <Text style={styles.questionText}>
                {cleanText}
              </Text>

              {/* Card Footer Watermark */}
              <View style={styles.cardFooter}>
                <View style={styles.verifiedRow}>
                  <Feather name="check-circle" size={12} color={COLORS.secondary} />
                  <Text style={styles.verifiedText}>Verified Solution Available</Text>
                </View>
                <Text style={styles.urlText} numberOfLines={1}>
                  {url.replace('https://', '')}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.primaryShareBtn}
              onPress={handleShareImage}
              activeOpacity={0.8}
              disabled={sharingImage}
            >
              {sharingImage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="image" size={16} color="#fff" />
                  <Text style={styles.primaryShareBtnText}>Share Image Card</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryShareBtn}
              onPress={handleShareText}
              activeOpacity={0.7}
              disabled={sharingImage}
            >
              <Feather name="message-circle" size={15} color={COLORS.text} />
              <Text style={styles.secondaryShareBtnText}>Share as Text & Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    maxHeight: '90%',
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    marginBottom: 12,
  },
  dialogTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dialogTitle: {
    fontFamily: FONTS.serif,
    fontSize: rf(16),
    fontWeight: '700',
    color: COLORS.text,
  },
  closeBtn: {
    padding: 4,
  },
  cardPreviewScroll: {
    paddingVertical: 6,
  },

  /* Branded Share Card */
  shareCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingBottom: 10,
    marginBottom: 12,
  },
  cardBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardLogoText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11.5),
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1.2,
  },
  brandDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.textMuted,
  },
  cardUniText: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    fontWeight: '600',
    color: COLORS.textSubtle,
    letterSpacing: 0.8,
  },
  cardSemKicker: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 0.5,
  },
  cardSubjectTitle: {
    fontFamily: FONTS.serif,
    fontSize: rf(17),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  cardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  qNumPill: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  qNumText: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    fontWeight: '700',
    color: COLORS.primary,
  },
  chapterPill: {
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    maxWidth: 160,
  },
  chapterText: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    color: COLORS.textSubtle,
    letterSpacing: 0.5,
  },
  questionText: {
    fontFamily: FONTS.serif,
    fontSize: rf(14),
    lineHeight: rf(22),
    color: COLORS.text,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontFamily: FONTS.mono,
    fontSize: rf(10),
    fontWeight: '700',
    color: COLORS.secondary,
    letterSpacing: 0.3,
  },
  urlText: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    color: COLORS.textSubtle,
    maxWidth: 160,
  },

  /* Buttons */
  actionButtons: {
    gap: 8,
    marginTop: 12,
  },
  primaryShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryShareBtnText: {
    fontFamily: FONTS.sans,
    fontSize: rf(13.5),
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 11,
    borderRadius: 10,
  },
  secondaryShareBtnText: {
    fontFamily: FONTS.sans,
    fontSize: rf(13),
    fontWeight: '600',
    color: COLORS.text,
  },
});
