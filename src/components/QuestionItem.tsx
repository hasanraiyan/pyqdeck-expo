import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import { QuestionSummary, Solution } from '../types';
import { getSolution } from '../api';
import { COLORS, FONTS } from '../theme/colors';
import { Badge, MarksBadge, AskAiBadge } from './Badge';
import { SolutionSkeleton } from './Skeleton';
import { cleanMarkdown } from '../utils/responsive';
import { questionMarkdownStyles, solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';

interface QuestionItemProps {
  question: QuestionSummary;
  subjectId: string;
  semesterId: string;
  subjectName?: string;
  showOpenButton?: boolean;
  hideYearBadge?: boolean;
}

export const QuestionItem: React.FC<QuestionItemProps> = React.memo(({
  question,
  subjectId,
  semesterId,
  subjectName,
  showOpenButton = true,
  hideYearBadge = false,
}) => {
  const navigation = useNavigation<any>();
  const [expanded, setExpanded] = useState(false);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [loadingSolution, setLoadingSolution] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleExpand = async () => {
    Haptics.selectionAsync();
    const willExpand = !expanded;
    setExpanded(willExpand);

    if (willExpand && question.hasSolution && !solution && !loadingSolution) {
      setLoadingSolution(true);
      try {
        const sol = await getSolution(subjectId, question.questionId);
        setSolution(sol);
      } catch (e) {
        console.error('Failed to load solution', e);
      } finally {
        setLoadingSolution(false);
      }
    }
  };

  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(question.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${question.text}\n\n[PYQDeck - ${question.year}]`,
      });
    } catch (e) {
      console.error(e);
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

  const handleOpenDetail = () => {
    navigation.navigate('QuestionDetail', {
      subjectId,
      semesterId,
      year: question.year,
      questionId: question.questionId,
      initialQuestion: question,
      initialSolution: solution,
      subjectName,
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={toggleExpand}
        style={[styles.header, expanded && styles.headerExpanded]}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.previewText} numberOfLines={1}>
            {question.qNumber ? (
              <Text style={styles.qNumber}>{question.qNumber}. </Text>
            ) : null}
            {question.textPreview || question.text}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {!hideYearBadge ? (
            <Badge label={question.year} variant="secondary" />
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
            <Markdown style={questionMarkdownStyles} rules={markdownRules}>
              {cleanMarkdown(question.text)}
            </Markdown>
          </View>

          {showOpenButton && (
            <TouchableOpacity
              style={styles.fullPageLink}
              onPress={handleOpenDetail}
            >
              <Text style={styles.fullPageLinkText}>
                View this question on its own page →
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={handleAskAi} activeOpacity={0.7}>
              <AskAiBadge />
            </TouchableOpacity>

            <View style={styles.actionButtonsRight}>
              <TouchableOpacity style={styles.actionIconButton} onPress={handleCopy} activeOpacity={0.6}>
                <Feather
                  name={copied ? 'check' : 'copy'}
                  size={15}
                  color={copied ? COLORS.primary : COLORS.textMuted}
                />
                <Text style={[styles.actionIconLabel, copied && { color: COLORS.primary }]}>
                  {copied ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionIconButton} onPress={handleShare} activeOpacity={0.6}>
                <Feather name="share-2" size={15} color={COLORS.textMuted} />
                <Text style={styles.actionIconLabel}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {question.hasSolution && (
            <View style={styles.solutionSection}>
              <Text style={styles.solutionTitle}>WORKED SOLUTION</Text>
              {solution ? (
                <View style={styles.solutionBody}>
                  <Markdown style={solutionMarkdownStyles} rules={markdownRules}>
                    {cleanMarkdown(solution.content)}
                  </Markdown>
                </View>
              ) : loadingSolution ? (
                <SolutionSkeleton />
              ) : (
                <Text style={styles.loadingText}>Failed to load solution.</Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  headerExpanded: {
    backgroundColor: COLORS.cardSecondary,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  qNumber: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
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
    fontFamily: FONTS.mono,
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
  fullPageLink: {
    marginTop: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  fullPageLinkText: {
    fontSize: 12.5,
    color: COLORS.primary,
    fontWeight: '600',
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
    fontFamily: FONTS.mono,
    color: COLORS.textMuted,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  solutionSection: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 16,
    marginTop: 16,
  },
  solutionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  solutionBody: {
    paddingTop: 4,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});
