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
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeContentRenderer } from './NativeContentRenderer';
import { QuestionSummary } from '../types';
import { AskAiBadge, YearBadge, MarksBadge, QNumBadge } from './Badge';
import { cleanMarkdown } from '../utils/responsive';
import { shareQuestion } from '../utils/links';
import { questionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { isAiEnabled } from '../config/features';

interface QuestionItemClassicProps {
  question: QuestionSummary;
  subjectId: string;
  semesterId: string;
  subjectName?: string;
  hideYearBadge?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const QuestionItemClassic: React.FC<QuestionItemClassicProps> = React.memo(({
  question,
  subjectId,
  semesterId,
  subjectName,
  hideYearBadge = false,
  style,
}) => {
  const navigation = useNavigation<any>();
  const [copied, setCopied] = useState(false);

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

  const handleGoogleSearch = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!question?.text) return;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(question.text)}`;
    try {
      await WebBrowser.openBrowserAsync(searchUrl, {
        toolbarColor: COLORS.card,
        controlsColor: COLORS.primary,
        secondaryToolbarColor: COLORS.background,
        showTitle: true,
        enableBarCollapsing: true,
      });
    } catch (err) {
      console.error(err);
    }
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
    <View style={[styles.card, style]}>
      {/* Top Meta Row: Year on LEFT, Q Number & Marks on RIGHT */}
      <View style={styles.headerRow}>
        <View style={styles.leftCluster}>
          {!hideYearBadge && question.year ? (
            <YearBadge year={question.year} variant="teal" />
          ) : null}
        </View>

        <View style={styles.rightCluster}>
          <TouchableOpacity
            onPress={() => handleOpenDetail(false)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <QNumBadge
              qNum={question.qNumber || question.questionId}
              variant="primary"
            />
          </TouchableOpacity>

          {question.marks ? (
            <MarksBadge marks={question.marks} />
          ) : null}
        </View>
      </View>

      {/* Module Strip */}
      {Boolean(question.chapter) && (
        <View style={styles.moduleStrip}>
          <Feather name="layers" size={13} color={COLORS.primary} />
          <Text style={styles.moduleText} numberOfLines={1}>
            {question.chapter.toLowerCase().startsWith('module')
              ? question.chapter
              : `Module: ${question.chapter}`}
          </Text>
        </View>
      )}

      {/* Question Body - tap anywhere to open detail */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleOpenDetail(question.hasSolution)}
        style={styles.bodyPressable}
      >
        <View pointerEvents="none">
          <NativeContentRenderer
            content={question.text}
            html={(question as any).textHtml}
            fontSize={15}
            variant="question"
          />
        </View>
      </TouchableOpacity>

      {/* High-CTR Navigation CTA */}
      <TouchableOpacity
        style={[
          styles.ctaButton,
          question.hasSolution ? styles.ctaButtonSolution : styles.ctaButtonDefault,
        ]}
        onPress={() => handleOpenDetail(question.hasSolution)}
        activeOpacity={0.82}
        accessibilityLabel={
          question.hasSolution
            ? 'Solution available, view question and solution details'
            : 'View question details'
        }
      >
        {question.hasSolution ? (
          <View style={styles.ctaRow}>
            <View style={styles.ctaBadgeWrapper}>
              <View style={styles.ctaCheckIcon}>
                <Feather name="check" size={12} color={COLORS.secondary} />
              </View>
              <Text style={styles.ctaSolutionText}>Solution Available</Text>
            </View>
            <View style={styles.ctaActionWrapper}>
              <Text style={styles.ctaActionText}>View Details</Text>
              <Feather name="arrow-right" size={14} color="#FFFFFF" />
            </View>
          </View>
        ) : (
          <View style={styles.ctaRow}>
            <View style={styles.ctaDefaultLeft}>
              <Feather name="file-text" size={14} color={COLORS.textMuted} />
              <Text style={styles.ctaDefaultText}>View Question Details</Text>
            </View>
            <Feather name="arrow-right" size={14} color={COLORS.textMuted} />
          </View>
        )}
      </TouchableOpacity>

      {/* Bottom Action Footer: Google, Copy, Share on left; Ask AI on right */}
      <View style={styles.footerRow}>
        <View style={styles.footerActionsLeft}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleGoogleSearch}
            activeOpacity={0.6}
            accessibilityLabel="Search question on Google"
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <FontAwesome name="google" size={15} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
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
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleShare}
            activeOpacity={0.6}
            accessibilityLabel="Share question"
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Feather name="share-2" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handleOpenDetail()}
            activeOpacity={0.6}
            accessibilityLabel="Open question detail screen"
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Feather name="maximize-2" size={15} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {isAiEnabled && (
          <TouchableOpacity onPress={handleAskAi} activeOpacity={0.7}>
            <AskAiBadge />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moduleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.cardSecondary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  moduleText: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    color: COLORS.textMuted,
    fontWeight: '500',
    flex: 1,
  },
  bodyPressable: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
  },
  footerActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButton: {
    borderRadius: RADIUS.md,
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  ctaButtonSolution: {
    backgroundColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  ctaButtonDefault: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaCheckIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSolutionText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  ctaActionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ctaDefaultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaDefaultText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
});
