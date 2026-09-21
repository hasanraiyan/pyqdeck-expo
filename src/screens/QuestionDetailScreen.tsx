import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Feather, FontAwesome } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import {
  getQuestion,
  getQuestions,
  getSolution,
  getSimilarQuestions,
  getRepeatedQuestions,
  voteSolution,
  reportSolution,
} from '../api';
import { QuestionSummary, Solution } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { Badge, MarksBadge, AskAiBadge, YearBadge, ShowSolnBadge, QNumBadge } from '../components/Badge';
import { PrevNextNav } from '../components/PrevNextNav';
import { SolutionSkeleton, SimilarQuestionSkeleton } from '../components/Skeleton';
import { rf, cleanMarkdown, useResponsive } from '../utils/responsive';
import { shareQuestion } from '../utils/links';
import { questionMarkdownStyles, solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { recordQuestionOpenedAndMaybeShowInterstitial } from '../utils/ads';
import { AdBanner } from '../components/AdBanner';
import { getMyVote, setMyVote } from '../utils/votes';
import { useRequireAuth } from '../auth/useRequireAuth';
import { WaveLoader } from '../components/WaveLoader';
import { isAiEnabled } from '../config/features';

export const QuestionDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { readMaxWidth, hPadding, isTablet } = useResponsive();
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
  const [loadingSolution, setLoadingSolution] = useState(false);
  const [solutionError, setSolutionError] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  // Deep links (see App.tsx's `linking` config) only carry semesterId/subjectId/
  // year/questionId - no subjectName - so backfill it from getQuestion's response.
  const [subjectName, setSubjectName] = useState<string | undefined>(paramSubjectName);
  const [paperQuestions, setPaperQuestions] = useState<QuestionSummary[]>([]);
  const [repeats, setRepeats] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(!initialQuestion);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [hasLoadedSimilar, setHasLoadedSimilar] = useState(false);
  const [similarError, setSimilarError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSimilar, setShowSimilar] = useState(true);
  const [showRepeats, setShowRepeats] = useState(true);
  const [myVote, setMyVoteState] = useState<1 | -1 | null>(null);
  const [voteCounts, setVoteCounts] = useState({ upvotes: 0, downvotes: 0 });
  const [isVoting, setIsVoting] = useState(false);
  const { guard } = useRequireAuth();
  // Refs to avoid stale closures during rapid taps (see optimistic UI race fix)
  const myVoteRef = useRef<1 | -1 | null>(null);
  const voteCountsRef = useRef({ upvotes: 0, downvotes: 0 });
  const pendingVoteRef = useRef<1 | -1 | 0 | null>(null);
  const actionIdRef = useRef(0);
  // Report state (anyone anonymous can report, DB only)
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<'incorrect' | 'incomplete' | 'formatting' | 'other' | null>(null);
  const [reportMsg, setReportMsg] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

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

  const loadSolution = useCallback(
    async (targetSubjectId: string = subjectId, targetQuestionId: string = questionId) => {
      if (!targetSubjectId || !targetQuestionId) return;
      setLoadingSolution(true);
      setSolutionError(false);
      try {
        const sol = await getSolution(targetSubjectId, targetQuestionId);
        setSolution(sol);
      } catch (e) {
        console.error('Failed to load solution', e);
        setSolutionError(true);
      } finally {
        setLoadingSolution(false);
      }
    },
    [subjectId, questionId]
  );

  const handleToggleSolution = () => {
    if (solution) {
      Haptics.selectionAsync();
      setShowSolution((prev) => !prev);
      return;
    }
    if (loadingSolution) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSolution(true);
    void loadSolution();
  };

  const handleLoadSimilar = async () => {
    if (loadingSimilar) return;
    if (hasLoadedSimilar) {
      Haptics.selectionAsync();
      setShowSimilar((prev) => !prev);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoadingSimilar(true);
    setSimilarError(false);
    setShowSimilar(true);
    try {
      const simData = await getSimilarQuestions(subjectId, questionId);
      setSimilar(simData.questions || []);
      setHasLoadedSimilar(true);
    } catch (e) {
      console.error('Failed to load similar questions', e);
      setSimilarError(true);
    } finally {
      setLoadingSimilar(false);
    }
  };

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
        if (initialSolution && (!initialSolution.questionId || initialSolution.questionId === questionId)) {
          setSolution(initialSolution);
          setLoadingSolution(false);
          setSolutionError(false);
        }
        const [repData, paperData] = await Promise.all([
          getRepeatedQuestions(subjectId, questionId).catch(() => ({ questions: [] })),
          currentYear
            ? getQuestions(subjectId, { year: Number(currentYear), limit: 50 }).catch(() => null)
            : Promise.resolve(null),
        ]);
        setRepeats(repData.questions || []);
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
  }, [subjectId, questionId, currentYear, loadSolution]);

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
    setShowSolution(false);
    setLoadingSolution(false);
    setSolutionError(false);
    setRepeats([]);
    setSimilar([]);
    setHasLoadedSimilar(false);
    setLoadingSimilar(false);
    setSimilarError(false);
    setShowSimilar(true);
    setShowRepeats(true);
    setCopied(false);
    setLoading(false);
    navigation.setParams({
      questionId: q.questionId,
      year: q.year,
      initialQuestion: q,
      initialSolution: null,
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

  const handleCopy = async () => {
    if (!question) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(question.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!question) return;
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
      const result = await voteSolution(subjectId, questionId, nextValue);
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

  const performVote = async (value: 1 | -1) => {
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

  // Voting needs an account. guard() runs the vote straight away when signed
  // in; otherwise it parks it, opens the sign-in sheet, and replays it once
  // the user comes back - so the tap they made is the vote they get.
  const handleVote = (value: 1 | -1) => {
    guard(() => {
      void performVote(value);
    });
  };

  const handleReportSubmit = async () => {
    if (!reportReason || reportSubmitting) return;
    if (reportReason === 'other' && reportMsg.trim().length < 4) return;
    setReportSubmitting(true);
    try {
      await reportSolution(subjectId, questionId, reportReason, reportMsg.trim() || undefined);
      setReported(true);
      setShowReport(false);
      setReportReason(null);
      setReportMsg('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const msg = e?.message?.includes('already reported') ? 'You have already reported this solution' : e?.message || 'Failed to report';
      // simple alert via Haptics + could show toast; keep minimal
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // reset to allow retry, but keep modal open
    } finally {
      setReportSubmitting(false);
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
        <WaveLoader color={COLORS.primary} dotSize={6} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollFlex}
        contentContainerStyle={[styles.scroll, { paddingHorizontal: hPadding }]}
      >
        <View style={[styles.centerWrapper, { maxWidth: readMaxWidth }]}>
          {/* Question Card (Always Classic UI) */}
          <View style={[styles.questionCard, styles.questionCardClassic]}>
            {/* Top row inside card: Year on left, Q-Number & Marks badge on right */}
            <View style={styles.qNumRowClassic}>
              <View style={styles.qNumLeftGroup}>
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
                    <YearBadge year={question.year} variant="teal" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.qNumRightGroup}>
                <QNumBadge
                  qNum={question.qNumber || question.questionId}
                  variant="primary"
                />
                {question.marks ? (
                  <MarksBadge marks={question.marks} />
                ) : null}
              </View>
            </View>

            {Boolean(question.chapter) && (
              <View style={styles.detailModuleStrip}>
                <Feather name="layers" size={13} color={COLORS.primary} />
                <Text style={styles.detailModuleText} numberOfLines={1}>
                  {question.chapter.toLowerCase().startsWith('module')
                    ? question.chapter
                    : `Module: ${question.chapter}`}
                </Text>
              </View>
            )}

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
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {repeats
                      .slice()
                      .sort((a, b) => b.year - a.year)
                      .map((item, idx) => (
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
                          activeOpacity={0.7}
                        >
                          <YearBadge year={item.year} variant="primary" />
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
              </View>
            )}

            {/* Action buttons (Classic UI) */}
            <View style={styles.actionsRowClassic}>
              <View style={styles.actionButtonsLeftClassic}>
                <TouchableOpacity
                  style={styles.actionIconButton}
                  onPress={handleGoogleSearch}
                  activeOpacity={0.6}
                  accessibilityLabel="Search question on Google"
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <FontAwesome name="google" size={15} color={COLORS.textMuted} />
                  {isTablet && <Text style={styles.actionIconLabel}>Google</Text>}
                </TouchableOpacity>

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
                  {isTablet && (
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
                  {isTablet && <Text style={styles.actionIconLabel}>Share</Text>}
                </TouchableOpacity>

                {(question?.hasSolution || Boolean(solution) || loadingSolution) && (
                  <TouchableOpacity
                    onPress={handleToggleSolution}
                    activeOpacity={0.7}
                    disabled={loadingSolution}
                    style={{ marginLeft: 4 }}
                  >
                    <ShowSolnBadge
                      isOpen={showSolution && Boolean(solution)}
                      loading={loadingSolution}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {isAiEnabled && (
                <TouchableOpacity onPress={openAiSearch} activeOpacity={0.7}>
                  <AskAiBadge />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Worked Solution */}
          {showSolution && (question?.hasSolution || Boolean(solution) || loadingSolution) && (
            <View style={styles.solutionSection}>
              <Text style={styles.solutionTitle}>WORKED SOLUTION</Text>
              {solution ? (
                <View style={styles.solutionBody}>
                  <Markdown style={solutionMarkdownStyles} rules={markdownRules}>
                    {cleanMarkdown(solution.content)}
                  </Markdown>
                  <View style={styles.voteRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
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
                    <TouchableOpacity
                      style={[styles.reportBtn, reported && { opacity: 0.6 }]}
                      activeOpacity={0.6}
                      onPress={() => guard(() => setShowReport(true), 'report')}
                      disabled={reported}
                    >
                      <Feather name="flag" size={12} color={reported ? COLORS.primary : COLORS.textMuted} />
                      <Text style={[styles.reportText, reported && { color: COLORS.primary }]}>{reported ? 'Reported' : 'Report'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : loadingSolution ? (
                <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <WaveLoader color={COLORS.primary} dotSize={5} />
                  <Text style={[styles.loadingText, { marginTop: 4 }]}>Loading solution…</Text>
                </View>
              ) : solutionError ? (
                <TouchableOpacity
                  style={styles.solutionErrorBtn}
                  onPress={handleToggleSolution}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={13} color={COLORS.primary} />
                  <Text style={styles.solutionErrorText}>Could not load solution — tap to retry</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.solutionErrorBtn}
                  onPress={handleToggleSolution}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={13} color={COLORS.primary} />
                  <Text style={styles.solutionErrorText}>Tap to load solution</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Similar Questions (On-demand to save backend vector search costs) */}
          <View style={styles.relatedSection}>
            {!hasLoadedSimilar ? (
              <View>
                <TouchableOpacity
                  style={styles.onDemandSimilarCard}
                  activeOpacity={0.7}
                  onPress={handleLoadSimilar}
                  disabled={loadingSimilar}
                >
                  <View style={styles.onDemandSimilarLeft}>
                    <View style={styles.onDemandSimilarIconBox}>
                      <Feather name="layers" size={15} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.onDemandSimilarTitle}>Similar Questions</Text>
                      <Text style={styles.onDemandSimilarSub}>
                        Find related questions from other exam papers
                      </Text>
                    </View>
                  </View>

                  {loadingSimilar ? (
                    <View style={styles.onDemandLoadingWrap}>
                      <WaveLoader color={COLORS.primary} dotSize={4} />
                    </View>
                  ) : (
                    <View style={styles.onDemandFindBtn}>
                      <Text style={styles.onDemandFindBtnText}>Find</Text>
                      <Feather name="arrow-right" size={12} color={COLORS.primary} />
                    </View>
                  )}
                </TouchableOpacity>

                {loadingSimilar && (
                  <View style={{ marginTop: 8 }}>
                    <SimilarQuestionSkeleton />
                  </View>
                )}
              </View>
            ) : (
              <>
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
                  similar.length === 0 ? (
                    <View style={styles.similarEmptyBox}>
                      <Text style={styles.similarEmptyText}>
                        No similar questions found in other papers.
                      </Text>
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
                              <YearBadge year={item.year} />
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
              </>
            )}

            {similarError && !loadingSimilar && (
              <TouchableOpacity
                style={styles.solutionErrorBtn}
                onPress={handleLoadSimilar}
                activeOpacity={0.7}
              >
                <Feather name="refresh-cw" size={13} color={COLORS.primary} />
                <Text style={styles.solutionErrorText}>
                  Could not load similar questions — tap to retry
                </Text>
              </TouchableOpacity>
            )}
          </View>
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

      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <TouchableWithoutFeedback onPress={() => setShowReport(false)}>
          <View style={styles.reportOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.reportSheet, { paddingBottom: 24 + 16 }]}>
                <View style={styles.reportHandle} />
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                <Text style={styles.reportTitle}>Report solution</Text>
                <Text style={styles.reportSubtitle}>What’s wrong? Anyone anonymous can report — DB only.</Text>
                {(['incorrect','incomplete','formatting','other'] as const).map((r) => (
                  <TouchableOpacity key={r} style={[styles.reportOption, reportReason===r && styles.reportOptionActive]} onPress={() => setReportReason(r)} activeOpacity={0.7}>
                    <View style={[styles.radio, reportReason===r && styles.radioActive]}>
                      {reportReason===r && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reportOptionText, reportReason===r && styles.reportOptionTextActive]}>
                      {r==='incorrect' ? 'Incorrect answer' : r==='incomplete' ? 'Incomplete explanation' : r==='formatting' ? 'Formatting / math issue' : 'Other'}
                    </Text>
                  </TouchableOpacity>
                ))}
                {reportReason && (
                  <TextInput
                    placeholder={reportReason==='other' ? 'Describe what is wrong (required)' : 'Optional details (max 500)'}
                    placeholderTextColor={COLORS.textSubtle}
                    value={reportMsg}
                    onChangeText={setReportMsg}
                    multiline
                    maxLength={500}
                    style={styles.reportInput}
                  />
                )}
                <TouchableOpacity
                  style={[styles.reportSubmitBtn, (!reportReason || (reportReason==='other' && reportMsg.trim().length<4) || reportSubmitting) && styles.reportSubmitBtnDisabled]}
                  onPress={handleReportSubmit}
                  disabled={!reportReason || (reportReason==='other' && reportMsg.trim().length<4) || reportSubmitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reportSubmitText}>{reportSubmitting ? 'Submitting…' : 'Submit report'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportCancelBtn} onPress={() => setShowReport(false)} activeOpacity={0.7}>
                  <Text style={styles.reportCancelText}>Cancel</Text>
                </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
    paddingTop: 4,
    paddingBottom: 24,
  },
  centerWrapper: {
    // The cap comes from useResponsive().readMaxWidth at the call site; this
    // stays as the fallback for any render before that resolves.
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
  questionCardClassic: {
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderRadius: 14,
  },
  qNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  qNumRowClassic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 2,
  },
  qNumRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailModuleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.cardSecondary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginHorizontal: -14,
    marginBottom: 8,
  },
  detailModuleText: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    color: COLORS.textMuted,
    fontWeight: '500',
    flex: 1,
  },
  actionsRowClassic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  actionButtonsLeftClassic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  loadingText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  solutionErrorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 12,
    borderRadius: 6,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  solutionErrorText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  reportText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  reportHint: {
    fontSize: 11,
    color: COLORS.textSubtle,
  },
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: COLORS.card,
    // Caps the sheet so the ScrollView inside has something to scroll within:
    // with the keyboard up, the options + input + buttons are taller than the
    // space left over on a normal phone.
    maxHeight: '90%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 12.5,
    color: COLORS.textMuted,
    marginBottom: 14,
  },
  reportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    marginBottom: 8,
  },
  reportOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  reportOptionText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  reportOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  reportInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.text,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 4,
    marginBottom: 12,
  },
  reportSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  reportSubmitBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  reportSubmitText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  reportCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  reportCancelText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
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
  onDemandSimilarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  onDemandSimilarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  onDemandSimilarIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onDemandSimilarTitle: {
    fontFamily: FONTS.serif,
    fontSize: rf(13.5),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  onDemandSimilarSub: {
    fontFamily: FONTS.sans,
    fontSize: rf(11.5),
    color: COLORS.textMuted,
    lineHeight: rf(15),
  },
  onDemandLoadingWrap: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  onDemandFindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  onDemandFindBtnText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11.5),
    fontWeight: '700',
    color: COLORS.primary,
  },
  similarEmptyBox: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  similarEmptyText: {
    fontFamily: FONTS.sans,
    fontSize: rf(12.5),
    color: COLORS.textMuted,
    textAlign: 'center',
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

