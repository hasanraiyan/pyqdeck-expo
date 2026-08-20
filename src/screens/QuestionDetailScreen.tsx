import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import {
  getQuestion,
  getQuestions,
  getSolution,
  getSimilarQuestions,
  getRepeatedQuestions,
} from '../api';
import { QuestionSummary, Solution } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { Badge, MarksBadge } from '../components/Badge';
import { PrevNextNav } from '../components/PrevNextNav';
import { SolutionSkeleton } from '../components/Skeleton';
import { rf, cleanMarkdown } from '../utils/responsive';

export const QuestionDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const {
    subjectId,
    semesterId,
    year,
    questionId,
    initialQuestion,
    initialSolution,
    subjectName,
  } = route.params || {};

  const [question, setQuestion] = useState<QuestionSummary | null>(
    initialQuestion || null
  );
  const [solution, setSolution] = useState<Solution | null>(
    initialSolution || null
  );
  const [paperQuestions, setPaperQuestions] = useState<QuestionSummary[]>([]);
  const [repeats, setRepeats] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(!initialQuestion);
  const [copied, setCopied] = useState(false);
  const [showSimilar, setShowSimilar] = useState(true);
  const [showRepeats, setShowRepeats] = useState(true);

  const currentYear = question?.year || year;

  useEffect(() => {
    const loadAll = async () => {
      try {
        if (!initialQuestion) {
          const res = await getQuestion(subjectId, questionId);
          if (res.questions && res.questions.length > 0) {
            setQuestion(res.questions[0]);
          }
        }
        if (!initialSolution) {
          const sol = await getSolution(subjectId, questionId).catch(() => null);
          setSolution(sol);
        }
        const [repData, simData, paperData] = await Promise.all([
          getRepeatedQuestions(subjectId, questionId).catch(() => ({ questions: [] })),
          getSimilarQuestions(subjectId, questionId).catch(() => ({ questions: [] })),
          currentYear
            ? getQuestions(subjectId, { year: Number(currentYear), limit: 50 }).catch(() => null)
            : Promise.resolve(null),
        ]);
        setRepeats(repData.questions || []);
        setSimilar(simData.questions || []);
        if (paperData?.questions) {
          setPaperQuestions(paperData.questions);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [subjectId, questionId, currentYear]);

  const handleCopy = async () => {
    if (!question) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(question.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!question) return;
    try {
      await Share.share({
        message: `${question.text}\n\n[PYQDeck - ${question.year}]`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Previous & Next navigation in the same paper
  const currentIndex = paperQuestions.findIndex(
    (q) => q.questionId === questionId
  );
  const prevQuestion =
    currentIndex > 0 ? paperQuestions[currentIndex - 1] : null;
  const nextQuestion =
    currentIndex >= 0 && currentIndex < paperQuestions.length - 1
      ? paperQuestions[currentIndex + 1]
      : null;

  const hasNav = Boolean(prevQuestion || nextQuestion);

  if (loading || !question) {
    return (
      <View style={[styles.container, styles.centerLoading]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 24 },
        ]}
      >
        <View style={styles.centerWrapper}>
          {/* Breadcrumb / Paper info */}
          <View style={styles.metaRow}>
            <Text style={styles.subjectText}>{subjectName || 'Subject'}</Text>
            <View style={styles.badgeGroup}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('QuestionList', {
                    semesterId,
                    subjectId,
                    subjectName,
                    initialYear: question.year,
                  })
                }
                activeOpacity={0.7}
              >
                <Badge label={question.year} variant="secondary" />
              </TouchableOpacity>
              <MarksBadge marks={question.marks} />
            </View>
          </View>

          {question.chapter ? (
            <Text style={styles.chapter}>{question.chapter}</Text>
          ) : null}

          {/* Question Card */}
          <View style={styles.questionCard}>
            {question.qNumber ? (
              <View style={styles.qNumRow}>
                <Text style={styles.qNumber}>
                  {String(question.qNumber).startsWith('Q')
                    ? question.qNumber
                    : `Q${question.qNumber}`}
                </Text>
              </View>
            ) : null}

            <Markdown style={markdownStyles}>{cleanMarkdown(question.text)}</Markdown>

            {/* Alert: Repeated in previous years (with clickable years) */}
            {repeats && repeats.length > 0 && (
              <View style={styles.repeatAlert}>
                <View style={styles.repeatHeader}>
                  <Feather name="repeat" size={14} color={COLORS.primary} />
                  <Text style={styles.repeatAlertTitle}>
                    This question has repeated before
                  </Text>
                </View>
                <View style={styles.repeatYearsRow}>
                  <Text style={styles.repeatAlertDesc}>Also appeared in: </Text>
                  {repeats
                    .slice()
                    .sort((a, b) => b.year - a.year)
                    .map((item, idx, arr) => (
                      <TouchableOpacity
                        key={`${item.questionId || idx}`}
                        onPress={() =>
                          navigation.push('QuestionDetail', {
                            subjectId: item.subject?.id || subjectId,
                            semesterId: item.subject?.semesterId || semesterId,
                            year: item.year,
                            questionId: item.questionId,
                            initialQuestion: item,
                            subjectName: item.subject?.name || subjectName,
                          })
                        }
                        style={styles.repeatYearLink}
                      >
                        <Text style={styles.repeatYearLinkText}>{item.year}</Text>
                        {idx < arr.length - 1 ? <Text style={styles.repeatComma}>, </Text> : null}
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            )}

            {/* Action buttons */}
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

              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Feather name="share-2" size={14} color={COLORS.textMuted} />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Worked Solution */}
          {question.hasSolution && (
            <View style={styles.solutionSection}>
              <Text style={styles.solutionTitle}>WORKED SOLUTION</Text>
              {solution ? (
                <View style={styles.solutionBody}>
                  <Markdown style={solutionMarkdownStyles}>
                    {cleanMarkdown(solution.content)}
                  </Markdown>
                </View>
              ) : (
                <SolutionSkeleton />
              )}
            </View>
          )}

          {/* Similar Questions (collapsible) */}
          {similar.length > 0 && (
            <View style={styles.relatedSection}>
              <TouchableOpacity
                style={styles.sectionHeaderBtn}
                activeOpacity={0.7}
                onPress={() => setShowSimilar(!showSimilar)}
              >
                <Text style={styles.relatedHeading}>
                  SIMILAR QUESTIONS ({similar.length})
                </Text>
                <Feather
                  name={showSimilar ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
              {showSimilar && (
                <View style={[styles.similarContainer, { marginTop: 8 }]}>
                  {similar.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.similarRow}
                      activeOpacity={0.7}
                      onPress={() =>
                        navigation.push('QuestionDetail', {
                          subjectId: item.subject?.id || subjectId,
                          semesterId: item.subject?.semesterId || semesterId,
                          year: item.year,
                          questionId: item.questionId,
                          initialQuestion: item,
                          subjectName: item.subject?.name || subjectName,
                        })
                      }
                    >
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.similarSubject}>
                          {item.subject?.name || subjectName}
                        </Text>
                        <Text style={styles.similarText} numberOfLines={1}>
                          {cleanMarkdown(item.textPreview || item.text)}
                        </Text>
                      </View>
                      <View style={styles.badgeGroup}>
                        <Badge label={item.year} variant="secondary" />
                        <MarksBadge marks={item.marks} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
          {/* Prev / Next Question in Paper Nav */}
          {hasNav && (
            <View style={styles.navSection}>
              <PrevNextNav
                prev={
                  prevQuestion
                    ? {
                        label:
                          prevQuestion.textPreview ||
                          (String(prevQuestion.qNumber).startsWith('Q')
                            ? prevQuestion.qNumber
                            : `Q${prevQuestion.qNumber}`),
                        sublabel: 'Previous',
                        onPress: () =>
                          navigation.push('QuestionDetail', {
                            subjectId,
                            semesterId,
                            year,
                            questionId: prevQuestion.questionId,
                            initialQuestion: prevQuestion,
                            subjectName,
                          }),
                      }
                    : null
                }
                next={
                  nextQuestion
                    ? {
                        label:
                          nextQuestion.textPreview ||
                          (String(nextQuestion.qNumber).startsWith('Q')
                            ? nextQuestion.qNumber
                            : `Q${nextQuestion.qNumber}`),
                        sublabel: 'Next',
                        onPress: () =>
                          navigation.push('QuestionDetail', {
                            subjectId,
                            semesterId,
                            year,
                            questionId: nextQuestion.questionId,
                            initialQuestion: nextQuestion,
                            subjectName,
                          }),
                      }
                    : null
                }
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subjectText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chapter: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: COLORS.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  questionCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
  },
  qNumRow: {
    marginBottom: 6,
  },
  qNumber: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  repeatAlert: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 6,
    padding: 12,
    marginTop: 14,
  },
  repeatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  repeatAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  repeatAlertDesc: {
    fontSize: 12.5,
    color: COLORS.text,
    lineHeight: 18,
  },
  repeatYearsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 2,
  },
  repeatYearLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  repeatYearLinkText: {
    fontSize: 12.5,
    fontFamily: FONTS.mono,
    fontWeight: '700',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  repeatComma: {
    fontSize: 12.5,
    color: COLORS.text,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  solutionSection: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 16,
    marginBottom: 20,
  },
  solutionTitle: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  solutionBody: {
    paddingTop: 4,
  },
  relatedSection: {
    marginTop: 16,
  },
  sectionHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  relatedHeading: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1.2,
  },
  relatedCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  relatedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  relatedText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  similarContainer: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
  },
  similarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  similarSubject: {
    fontFamily: 'Courier',
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
    marginBottom: 3,
  },
  similarText: {
    fontSize: 13,
    color: COLORS.text,
  },
  centerWrapper: {
    width: '100%',
  },
  navSection: {
    marginTop: 18,
    width: '100%',
  },
});

const markdownStyles = {
  body: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 24,
  },
  code_inline: {
    backgroundColor: COLORS.cardSecondary,
    color: COLORS.primary,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  code_block: {
    backgroundColor: COLORS.cardSecondary,
    padding: 12,
    borderRadius: 6,
    color: COLORS.text,
  },
};

const solutionMarkdownStyles = {
  body: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
  },
  code_inline: {
    backgroundColor: COLORS.cardSecondary,
    color: COLORS.primary,
  },
};

