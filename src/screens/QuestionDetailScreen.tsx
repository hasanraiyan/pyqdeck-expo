import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import {
  getQuestion,
  getQuestions,
  getSolution,
  getSimilarQuestions,
  getRepeatedQuestions,
  voteSolution,
} from '../api';
import { QuestionSummary, Solution } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { Badge, MarksBadge, AskAiBadge, YearBadge } from '../components/Badge';
import { PrevNextNav } from '../components/PrevNextNav';
import { SolutionSkeleton, SimilarQuestionSkeleton } from '../components/Skeleton';
import { rf, cleanMarkdown } from '../utils/responsive';
import { buildQuestionUrl } from '../utils/links';
import { questionMarkdownStyles, solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { recordQuestionOpenedAndMaybeShowInterstitial } from '../utils/ads';
import { AdBanner } from '../components/AdBanner';
import { getVoterId } from '../utils/voterId';
import { getMyVote, setMyVote } from '../utils/votes';

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
    subjectName: paramSubjectName,
  } = route.params || {};

  const [question, setQuestion] = useState<QuestionSummary | null>(
    initialQuestion || null
  );
  const [solution, setSolution] = useState<Solution | null>(
    initialSolution || null
  );
  // Deep links (see App.tsx's `linking` config) only carry semesterId/subjectId/
  // year/questionId - no subjectName - so backfill it from getQuestion's response.
  const [subjectName, setSubjectName] = useState<string | undefined>(paramSubjectName);
  const [paperQuestions, setPaperQuestions] = useState<QuestionSummary[]>([]);
  const [repeats, setRepeats] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(!initialQuestion);
  const [loadingRelated, setLoadingRelated] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showSimilar, setShowSimilar] = useState(true);
  const [showRepeats, setShowRepeats] = useState(true);
  const [myVote, setMyVoteState] = useState<1 | -1 | null>(null);
  const [voteCounts, setVoteCounts] = useState({ upvotes: 0, downvotes: 0 });
  const [isVoting, setIsVoting] = useState(false);
  // Refs to avoid stale closures during rapid taps (see optimistic UI race fix)
  const myVoteRef = useRef<1 | -1 | null>(null);
  const voteCountsRef = useRef({ upvotes: 0, downvotes: 0 });
  const pendingVoteRef = useRef<1 | -1 | 0 | null>(null);
  const actionIdRef = useRef(0);

  const currentYear = question?.year || year;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    recordQuestionOpenedAndMaybeShowInterstitial();
  }, [questionId]);

  useEffect(() => {
    if (solution) {
      setVoteCounts({ upvotes: solution.upvotes ?? 0, downvotes: solution.downvotes ?? 0 });
    }
  }, [solution]);

  useEffect(() => {
    if (!questionId) return;
    getMyVote(questionId).then(setMyVoteState);
  }, [questionId]);

  // Keep refs in sync for stale-closure-free optimistic math
  useEffect(() => {
    myVoteRef.current = myVote;
  }, [myVote]);
  useEffect(() => {
    voteCountsRef.current = voteCounts;
  }, [voteCounts]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        if (!initialQuestion) {
          const res = await getQuestion(subjectId, questionId);
          if (res.questions && res.questions.length > 0) {
            setQuestion(res.questions[0]);
          }
          if (!paramSubjectName && res.subject?.name) {
            setSubjectName(res.subject.name);
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
        setLoadingRelated(false);
      }
    };
    loadAll();
  }, [subjectId, questionId, currentYear]);

  // Prev/Next-in-paper stays on this same screen instance (setParams, not
  // push) so AdBanner never unmounts - rapid-fire next/next/next taps would
  // otherwise fire a fresh ad request every time, which barely gives any
  // single ad time to be seen and looks like ad-refresh abuse to AdMob.
  // "Similar"/"repeated" question taps still use navigation.push below -
  // those are genuine drill-downs into different content worth a fresh ad
  // load and a real back-stack entry.
  const goToQuestion = (q: QuestionSummary) => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setQuestion(q);
    setSolution(null);
    setRepeats([]);
    setSimilar([]);
    setShowSimilar(true);
    setShowRepeats(true);
    setCopied(false);
    setLoading(false);
    setLoadingRelated(true);
    navigation.setParams({
      questionId: q.questionId,
      year: q.year,
      initialQuestion: q,
    });
  };

  const openAiSearch = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!question?.text) return;
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
      Linking.openURL(coursifyUrl).catch((e) => console.error(e));
    }
  };

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
      const url = buildQuestionUrl(semesterId, subjectId, question.year, questionId);
      await Share.share({ message: url, url });
    } catch (e) {
      console.error(e);
    }
  };

  // YouTube-style: optimistic UI with lock + actionId to prevent race.
  // Rapid taps (up/down/up in <300ms) previously used stale closures and
  // concurrent $inc on the server -> negative counts. Now we: 1) block
  // concurrent requests (isVoting), 2) coalesce last intent via pendingVoteRef,
  // 3) ignore stale out-of-order responses via actionIdRef, 4) clamp to 0.
  // Core executor: votes to explicit target (0=retract). Handles
  // optimistic + actionId + clamp. Used by handleVote and coalesced retry.
  const executeVote = async (nextValue: 1 | -1 | 0) => {
    const actionId = ++actionIdRef.current;
    const prevVote = myVoteRef.current;
    const prevCounts = { ...voteCountsRef.current };

    const optimistic = { ...prevCounts };
    if (prevVote) optimistic[prevVote === 1 ? 'upvotes' : 'downvotes'] = Math.max(0, optimistic[prevVote === 1 ? 'upvotes' : 'downvotes'] - 1);
    if (nextValue !== 0) optimistic[nextValue === 1 ? 'upvotes' : 'downvotes'] += 1;

    setVoteCounts(optimistic);
    voteCountsRef.current = optimistic;
    setMyVoteState(nextValue === 0 ? null : nextValue);
    myVoteRef.current = nextValue === 0 ? null : nextValue;
    setIsVoting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const voterId = await getVoterId();
      const result = await voteSolution(subjectId, questionId, voterId, nextValue);
      if (actionId !== actionIdRef.current) return;
      const clamped = { upvotes: Math.max(0, result.upvotes ?? 0), downvotes: Math.max(0, result.downvotes ?? 0) };
      setVoteCounts(clamped);
      voteCountsRef.current = clamped;
      await setMyVote(questionId, nextValue);
    } catch (e) {
      if (actionId !== actionIdRef.current) return;
      setVoteCounts(prevCounts);
      voteCountsRef.current = prevCounts;
      setMyVoteState(prevVote);
      myVoteRef.current = prevVote;
    } finally {
      if (actionId !== actionIdRef.current) return;
      setIsVoting(false);
      if (pendingVoteRef.current !== null) {
        const queued = pendingVoteRef.current;
        pendingVoteRef.current = null;
        executeVote(queued);
      }
    }
  };

  const handleVote = async (value: 1 | -1) => {
    if (isVoting) {
      // Coalesce rapid taps to final desired state (YouTube pattern).
      // Compute what the vote would be after applying this tap on top of
      // the pending target (if any) or current optimistic vote.
      const base: 1 | -1 | null = pendingVoteRef.current !== null
        ? pendingVoteRef.current === 0 ? null : (pendingVoteRef.current as 1 | -1)
        : myVoteRef.current;
      const nextTarget: 1 | -1 | 0 = base === value ? 0 : value;
      pendingVoteRef.current = nextTarget;
      // Reflect coalesced intent instantly
      const baseCounts = voteCountsRef.current;
      // Undo base, apply nextTarget
      const optimistic = { ...baseCounts };
      if (base) optimistic[base === 1 ? 'upvotes' : 'downvotes'] = Math.max(0, optimistic[base === 1 ? 'upvotes' : 'downvotes'] - 1);
      if (nextTarget !== 0) optimistic[nextTarget === 1 ? 'upvotes' : 'downvotes'] += 1;
      // But baseCounts already reflects base, so we need delta between base and nextTarget
      // Above already did base->nextTarget via baseCounts which is currently showing base.
      // However baseCounts is currently showing previous optimistic (maybe not base if pending already).
      // Simpler: recompute from displayed counts by adjusting.
      // To avoid double-adjust, just set to nextTarget optimistically via delta:
      // Since displayed counts = base, we can just do base->nextTarget.
      // Our optimistic above already does that correctly if baseCounts == base.
      // But baseCounts may be stale if we didn't update it for previous pending.
      // So we need to ensure voteCountsRef tracks pending target's counts.
      // We already updated it to reflect pending, so baseCounts is correctly base's counts.
      setVoteCounts(optimistic);
      voteCountsRef.current = optimistic;
      setMyVoteState(nextTarget === 0 ? null : nextTarget);
      myVoteRef.current = nextTarget === 0 ? null : nextTarget;
      return;
    }
    const nextValue: 1 | -1 | 0 = myVoteRef.current === value ? 0 : value;
    return executeVote(nextValue);
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
      <ScrollView ref={scrollRef} style={styles.scrollFlex} contentContainerStyle={styles.scroll}>
        <View style={styles.centerWrapper}>
          {/* Breadcrumb / Paper info */}
          <View style={styles.metaRow}>
            <Text style={styles.subjectText} numberOfLines={1}>
              {subjectName || 'Subject'}
              {question.chapter ? ` • ${question.chapter}` : ''}
            </Text>
          </View>

          {/* Question Card */}
          <View style={styles.questionCard}>
            {/* Top row inside card: Q-Number on left, Year & Marks badge on right */}
            <View style={styles.qNumRow}>
              <View style={styles.qNumLeftGroup}>
                <Text style={styles.qNumber}>
                  {question.qNumber
                    ? String(question.qNumber).startsWith('Q')
                      ? question.qNumber
                      : `Q${question.qNumber}`
                    : 'QUESTION'}
                </Text>
                {question.year ? (
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
                    <YearBadge year={question.year} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <MarksBadge marks={question.marks} />
            </View>

            <Markdown style={questionMarkdownStyles} rules={markdownRules}>
              {cleanMarkdown(question.text)}
            </Markdown>

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
              <TouchableOpacity onPress={openAiSearch} activeOpacity={0.7}>
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
          </View>

          {/* Worked Solution */}
          {question.hasSolution && (
            <View style={styles.solutionSection}>
              <Text style={styles.solutionTitle}>WORKED SOLUTION</Text>
              {solution ? (
                <View style={styles.solutionBody}>
                  <Markdown style={solutionMarkdownStyles} rules={markdownRules}>
                    {cleanMarkdown(solution.content)}
                  </Markdown>
                  <View style={styles.voteRow}>
                    <TouchableOpacity
                      style={[styles.voteButton, isVoting && { opacity: 0.6 }]}
                      activeOpacity={0.6}
                      onPress={() => handleVote(1)}
                    >
                      <Feather
                        name="thumbs-up"
                        size={15}
                        color={myVote === 1 ? COLORS.primary : COLORS.textMuted}
                      />
                      <Text style={[styles.voteCount, myVote === 1 && styles.voteCountActive]}>
                        {voteCounts.upvotes}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.voteButton, isVoting && { opacity: 0.6 }]}
                      activeOpacity={0.6}
                      onPress={() => handleVote(-1)}
                    >
                      <Feather
                        name="thumbs-down"
                        size={15}
                        color={myVote === -1 ? COLORS.primary : COLORS.textMuted}
                      />
                      <Text style={[styles.voteCount, myVote === -1 && styles.voteCountActive]}>
                        {voteCounts.downvotes}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <SolutionSkeleton />
              )}
            </View>
          )}

          {/* Similar Questions (collapsible) */}
          {(loadingRelated || similar.length > 0) && (
            <View style={styles.relatedSection}>
              <TouchableOpacity
                style={styles.sectionHeaderBtn}
                activeOpacity={0.7}
                onPress={() => setShowSimilar(!showSimilar)}
              >
                <Text style={styles.relatedHeading}>
                  SIMILAR QUESTIONS {loadingRelated ? '' : `(${similar.length})`}
                </Text>
                <Feather
                  name={showSimilar ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
              {showSimilar && (
                loadingRelated ? (
                  <View style={{ marginTop: 8 }}>
                    <SimilarQuestionSkeleton />
                  </View>
                ) : (
                  <View style={[styles.similarContainer, { marginTop: 8 }]}>
                    {similar.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.similarRow,
                          idx === similar.length - 1 && { borderBottomWidth: 0 },
                        ]}
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
                        {/* Top Line: Module/Subject on left, Year & Marks badge on right */}
                        <View style={styles.similarTopMeta}>
                          <Text style={styles.similarSubject} numberOfLines={1}>
                            {item.chapter || item.subject?.name || subjectName}
                          </Text>
                          <View style={styles.similarBadgeGroup}>
                            <Badge label={item.year} variant="secondary" />
                            <MarksBadge marks={item.marks} />
                          </View>
                        </View>

                        {/* Bottom Line: Question Preview Text */}
                        <Text style={styles.similarText} numberOfLines={2}>
                          {cleanMarkdown(item.textPreview || item.text)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
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
                        onPress: () => goToQuestion(prevQuestion),
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
                        onPress: () => goToQuestion(nextQuestion),
                      }
                    : null
                }
              />
            </View>
          )}
        </View>
      </ScrollView>

      <AdBanner />
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
  scrollFlex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  centerWrapper: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  metaRow: {
    marginBottom: 8,
  },
  subjectText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  qNumLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qNumber: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  qYearText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    justifyContent: 'space-between',
    marginTop: 16,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flex: 1,
    paddingRight: 10,
  },
  aiTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  aiTagText: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  modalTitle: {
    fontFamily: FONTS.serif,
    fontSize: rf(20),
    fontStyle: 'italic',
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: rf(12.5),
    color: COLORS.textMuted,
    marginTop: 3,
    lineHeight: rf(17),
  },
  modalCloseBtn: {
    padding: 6,
    marginTop: -2,
    marginRight: -4,
  },
  aiQuestionSnippet: {
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  aiSnippetLabel: {
    fontFamily: FONTS.mono,
    fontSize: rf(9),
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1,
    marginBottom: 4,
  },
  aiSnippetText: {
    fontSize: rf(12),
    color: COLORS.text,
    lineHeight: rf(17),
  },
  aiOptionsList: {
    gap: 10,
  },
  aiOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 12,
  },
  aiIconBox: {
    width: 38,
    height: 38,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aiOptionContent: {
    flex: 1,
    paddingRight: 8,
  },
  aiOptionTitle: {
    fontSize: rf(13.5),
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  aiOptionDesc: {
    fontSize: rf(11.5),
    color: COLORS.textMuted,
    lineHeight: rf(16),
  },
  solutionSection: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 16,
    marginBottom: 20,
  },
  solutionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  voteCount: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  voteCountActive: {
    color: COLORS.primary,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  similarTopMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  similarSubject: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: rf(10),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.textSubtle,
    paddingRight: 8,
  },
  similarBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  similarText: {
    fontSize: rf(13.5),
    color: COLORS.text,
    lineHeight: rf(19),
  },
  navSection: {
    marginTop: 18,
    width: '100%',
  },
});

