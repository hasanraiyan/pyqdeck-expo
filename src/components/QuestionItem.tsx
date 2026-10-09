import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeContentRenderer } from './NativeContentRenderer';
import { QuestionSummary } from '../types';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { MarksBadge, AskAiBadge, YearBadge } from './Badge';
import { InlineMathText } from './InlineMathText';
import { useResponsive } from '../utils/responsive';
import { isAiEnabled } from '../config/features';
import { shareQuestion } from '../utils/links';

interface QuestionItemProps {
  question: QuestionSummary;
  subjectId: string;
  semesterId: string;
  subjectName?: string;
  showOpenButton?: boolean;
  hideYearBadge?: boolean;
  /** Tighter header for pointer-first windows. Defaults to the window class. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const QuestionItem: React.FC<QuestionItemProps> = React.memo(({
  question,
  subjectId,
  semesterId,
  subjectName,
  showOpenButton = true,
  hideYearBadge = false,
  compact: compactProp,
  style,
}) => {
  const { compact: windowCompact } = useResponsive();
  const compact = compactProp ?? windowCompact;
  const navigation = useNavigation<any>();
  const [cardW, setCardW] = useState(0);
  const showActionLabels = cardW >= 520;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleExpand = () => {
    Haptics.selectionAsync();
    setExpanded((prev) => !prev);
  };

  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(question.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleAskAi = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (question?.text) {
      const coursifyUrl = `https://hasanraiyan.me/coursify?search_ai=${encodeURIComponent(question.text)}&send=true`;
      try {
        await WebBrowser.openBrowserAsync(coursifyUrl, {
          toolbarColor: COLORS.card,
          controlsColor: COLORS.primary,
          secondaryToolbarColor: COLORS.background,
          showTitle: true,
          enableBarCollapsing: true,
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleOpenDetail = (autoOpenSolution?: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('QuestionDetail', {
      subjectId,
      semesterId,
      year: question.year,
      questionId: question.questionId,
      initialQuestion: question,
      subjectName,
      autoOpenSolution: autoOpenSolution ?? Boolean(question.hasSolution),
    });
  };

  return (
    <View style={[styles.container, style]} onLayout={(e) => setCardW(e.nativeEvent.layout.width)}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={toggleExpand}
        style={[styles.header, compact && styles.headerCompact, expanded && styles.headerExpanded]}
      >
        <View style={styles.headerLeft}>
          <InlineMathText
            content={question.textPreview || question.text}
            prefix={question.qNumber ? `${question.qNumber}. ` : undefined}
            prefixStyle={styles.qNumber}
            style={styles.previewText}
            numberOfLines={1}
          />
        </View>
        <View style={styles.headerRight}>
          {!hideYearBadge && question.year ? (
            <YearBadge year={question.year} />
          ) : null}
          <MarksBadge marks={question.marks} />
          {expanded ? (
            <Feather name="chevron-up" size={16} color={COLORS.primary} />
          ) : (
            <Feather name="chevron-down" size={16} color={COLORS.textMuted} />
          )}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {question.chapter ? (
            <Text style={styles.chapter}>{question.chapter}</Text>
          ) : null}

          <View style={styles.markdownWrapper}>
            <NativeContentRenderer
              content={question.text}
              html={(question as any).textHtml}
              fontSize={15}
              variant="question"
            />
          </View>

          {/* Navigation link to the detail screen */}
          <TouchableOpacity
            style={styles.ctaLink}
            onPress={() => handleOpenDetail(question.hasSolution)}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="link"
            accessibilityLabel={
              question.hasSolution
                ? 'Solution available, view question and solution details'
                : 'View question details'
            }
          >
            {question.hasSolution ? (
              <>
                <Feather name="check-circle" size={14} color={COLORS.secondary} />
                <Text style={[styles.ctaLinkText, { color: COLORS.secondary }]} numberOfLines={1}>
                  Solution available
                  {' \u00b7 '}<Text style={styles.ctaLinkUnderline}>View details</Text>
                </Text>
                <Feather name="arrow-right" size={14} color={COLORS.secondary} />
              </>
            ) : (
              <>
                <Text style={[styles.ctaLinkText, { color: COLORS.primary }]} numberOfLines={1}>
                  <Text style={styles.ctaLinkUnderline}>View question details</Text>
                </Text>
                <Feather name="arrow-right" size={14} color={COLORS.primary} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.actionsRow}>
            <View style={styles.actionButtonsLeft}>
              {isAiEnabled && (
                <TouchableOpacity onPress={handleAskAi} activeOpacity={0.7}>
                  <AskAiBadge />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.actionButtonsRight}>
              <TouchableOpacity
                style={styles.actionIconButton}
                onPress={handleCopy}
                activeOpacity={0.6}
                accessibilityLabel={copied ? 'Copied' : 'Copy question text'}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Feather
                  name={copied ? 'check' : 'copy'}
                  size={16}
                  color={copied ? COLORS.primary : COLORS.textMuted}
                />
                {showActionLabels && (
                  <Text style={[styles.actionIconLabel, copied && { color: COLORS.primary }]}>
                    {copied ? 'Copied' : 'Copy'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionIconButton}
                onPress={handleShare}
                activeOpacity={0.6}
                accessibilityLabel="Share question"
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Feather name="share-2" size={16} color={COLORS.textMuted} />
                {showActionLabels && <Text style={styles.actionIconLabel}>Share</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  headerCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  headerExpanded: {
    backgroundColor: COLORS.background,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  qNumber: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chapter: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
  },
  markdownWrapper: {
    marginVertical: 4,
  },
  ctaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginHorizontal: 0,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 4,
  },
  ctaLinkText: {
    flexShrink: 1,
    fontFamily: FONTS.displayBold,
    fontSize: 12.5,
  },
  ctaLinkUnderline: {
    textDecorationLine: 'underline',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },
  actionButtonsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionIconLabel: {
    fontSize: 12,
    fontFamily: FONTS.displayBold,
    color: COLORS.textMuted,
    letterSpacing: 0.2,
  },
});
