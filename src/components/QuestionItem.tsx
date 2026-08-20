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
            <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
              {copied ? (
                <Feather name="check" size={14} color={COLORS.primary} />
              ) : (
                <Feather name="copy" size={14} color={COLORS.textMuted} />
              )}
              <Text style={[styles.actionText, copied && { color: COLORS.primary }]}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleAskAi} activeOpacity={0.7}>
              <AskAiBadge />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Feather name="share-2" size={14} color={COLORS.textMuted} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>

          {question.hasSolution && (
            <View style={styles.solutionContainer}>
              <View style={styles.solutionHeader}>
                <Text style={styles.solutionTag}>Solution</Text>
              </View>

              {solution ? (
                <Markdown style={solutionMarkdownStyles} rules={markdownRules}>
                  {cleanMarkdown(solution.content)}
                </Markdown>
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
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  qNumber: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: '#fafbfc',
  },
  chapter: {
    fontSize: 11,
    fontFamily: FONTS.mono,
    color: COLORS.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  markdownWrapper: {
    marginTop: 6,
  },
  fullPageLink: {
    marginTop: 10,
    paddingVertical: 4,
  },
  fullPageLinkText: {
    fontSize: 12.5,
    color: COLORS.primary,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  solutionContainer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: COLORS.borderDashed,
  },
  solutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  solutionTag: {
    fontSize: 11,
    fontFamily: FONTS.mono,
    color: COLORS.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

