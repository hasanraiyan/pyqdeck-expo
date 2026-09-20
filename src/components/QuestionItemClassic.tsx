import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import { QuestionSummary, Solution } from '../types';
import { getSolution, voteSolution, reportSolution } from '../api';
import { useRequireAuth } from '../auth/useRequireAuth';
import { getMyVote, setMyVote } from '../utils/votes';
import { AskAiBadge, ShowSolnBadge, YearBadge, MarksBadge, QNumBadge } from './Badge';
import { SolutionSkeleton } from './Skeleton';
import { cleanMarkdown } from '../utils/responsive';
import { buildQuestionUrl } from '../utils/links';
import { questionMarkdownStyles, solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { COLORS, FONTS } from '../theme/colors';

interface QuestionItemClassicProps {
  question: QuestionSummary;
  subjectId: string;
  semesterId: string;
  subjectName?: string;
  hideYearBadge?: boolean;
}

export const QuestionItemClassic: React.FC<QuestionItemClassicProps> = React.memo(({
  question,
  subjectId,
  semesterId,
  subjectName,
  hideYearBadge = false,
}) => {
  const navigation = useNavigation<any>();
  const [solution, setSolution] = useState<Solution | null>(null);
  const [loadingSolution, setLoadingSolution] = useState(false);
  const [solutionError, setSolutionError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  // Voting & reporting
  const [myVote, setMyVoteState] = useState<1 | -1 | null>(null);
  const [voteCounts, setVoteCounts] = useState({ upvotes: 0, downvotes: 0 });
  const [isVoting, setIsVoting] = useState(false);
  const { guard } = useRequireAuth();
  const myVoteRef = useRef<1 | -1 | null>(null);
  const voteCountsRef = useRef({ upvotes: 0, downvotes: 0 });
  const pendingVoteRef = useRef<1 | -1 | 0 | null>(null);
  const actionIdRef = useRef(0);

  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<'incorrect' | 'incomplete' | 'formatting' | 'other' | null>(null);
  const [reportMsg, setReportMsg] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

  const handleToggleSolution = async () => {
    if (solution) {
      Haptics.selectionAsync();
      setShowSolution((prev) => !prev);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoadingSolution(true);
    setSolutionError(false);
    try {
      const sol = await getSolution(subjectId, question.questionId);
      setSolution(sol);
      setShowSolution(true);
    } catch (e) {
      console.error('Failed to load solution', e);
      setSolutionError(true);
    } finally {
      setLoadingSolution(false);
    }
  };

  useEffect(() => {
    if (solution) setVoteCounts({ upvotes: solution.upvotes ?? 0, downvotes: solution.downvotes ?? 0 });
  }, [solution]);

  useEffect(() => {
    if (showSolution && question.questionId) getMyVote(question.questionId).then(setMyVoteState);
  }, [showSolution, question.questionId]);

  useEffect(() => {
    myVoteRef.current = myVote;
  }, [myVote]);
  useEffect(() => {
    voteCountsRef.current = voteCounts;
  }, [voteCounts]);

  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(question.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      const url = buildQuestionUrl(semesterId, subjectId, question.year, question.questionId);
      await Share.share({ message: url, url });
    } catch (e) {
      console.error(e);
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
      const result = await voteSolution(subjectId, question.questionId, nextValue);
      if (actionId !== actionIdRef.current) return;
      const clamped = { upvotes: Math.max(0, result.upvotes ?? 0), downvotes: Math.max(0, result.downvotes ?? 0) };
      setVoteCounts(clamped);
      voteCountsRef.current = clamped;
      await setMyVote(question.questionId, nextValue);
    } catch {
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
      const base: 1 | -1 | null = pendingVoteRef.current !== null ? (pendingVoteRef.current === 0 ? null : (pendingVoteRef.current as 1 | -1)) : myVoteRef.current;
      const nextTarget: 1 | -1 | 0 = base === value ? 0 : value;
      pendingVoteRef.current = nextTarget;
      const baseCounts = voteCountsRef.current;
      const optimistic = { ...baseCounts };
      if (base) optimistic[base === 1 ? 'upvotes' : 'downvotes'] = Math.max(0, optimistic[base === 1 ? 'upvotes' : 'downvotes'] - 1);
      if (nextTarget !== 0) optimistic[nextTarget === 1 ? 'upvotes' : 'downvotes'] += 1;
      setVoteCounts(optimistic);
      voteCountsRef.current = optimistic;
      setMyVoteState(nextTarget === 0 ? null : nextTarget);
      myVoteRef.current = nextTarget === 0 ? null : nextTarget;
      return;
    }
    const nextValue: 1 | -1 | 0 = myVoteRef.current === value ? 0 : value;
    return executeVote(nextValue);
  };

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
      await reportSolution(
        subjectId,
        question.questionId,
        reportReason,
        reportMsg.trim() || undefined
      );
      setReported(true);
      setShowReport(false);
      setReportReason(null);
      setReportMsg('');
    } catch {
      // keep modal open to let user retry
    } finally {
      setReportSubmitting(false);
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
    <View style={styles.card}>
      {/* Top Meta Row */}
      <View style={styles.headerRow}>
        <View style={styles.badgesCluster}>
          {!hideYearBadge && question.year ? (
            <YearBadge year={question.year} variant="teal" />
          ) : null}

          <QNumBadge
            qNum={question.qNumber || question.questionId}
            variant="primary"
          />

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

      {/* Question Body */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleOpenDetail}
        style={styles.bodyPressable}
      >
        <Markdown style={questionMarkdownStyles} rules={markdownRules}>
          {cleanMarkdown(question.text)}
        </Markdown>
      </TouchableOpacity>

      {/* Bottom Action Footer */}
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

          {(question.hasSolution || Boolean(solution)) && (
            <TouchableOpacity
              onPress={handleToggleSolution}
              activeOpacity={0.7}
              style={{ marginLeft: 4 }}
            >
              <ShowSolnBadge isOpen={showSolution} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleAskAi} activeOpacity={0.7}>
          <AskAiBadge />
        </TouchableOpacity>
      </View>

      {/* Inline Solution (if user tapped Show Soln) */}
      {showSolution && solution && (
        <View style={styles.solutionSection}>
          <Text style={styles.solutionTitle}>WORKED SOLUTION</Text>
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
                    size={14}
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
                    size={14}
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
                <Feather
                  name="flag"
                  size={12}
                  color={reported ? COLORS.primary : COLORS.textMuted}
                />
                <Text style={[styles.reportText, reported && { color: COLORS.primary }]}>
                  {reported ? 'Reported' : 'Report'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showSolution && loadingSolution && (
        <View style={styles.solutionSection}>
          <Text style={styles.solutionTitle}>WORKED SOLUTION</Text>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading solution…</Text>
          </View>
          <SolutionSkeleton />
        </View>
      )}

      {showSolution && solutionError && (
        <TouchableOpacity
          style={styles.solutionErrorBtn}
          onPress={handleToggleSolution}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={13} color={COLORS.primary} />
          <Text style={styles.solutionErrorText}>Could not load solution — tap to retry</Text>
        </TouchableOpacity>
      )}

      {/* Report Modal */}
      <Modal
        visible={showReport}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReport(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowReport(false)}>
          <View style={styles.reportOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.reportSheet, { paddingBottom: 24 }]}>
                <View style={styles.reportHandle} />
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  <Text style={styles.reportTitle}>Report solution</Text>
                  <Text style={styles.reportSubtitle}>
                    What’s wrong? Anyone anonymous can report — DB only.
                  </Text>
                  {(['incorrect', 'incomplete', 'formatting', 'other'] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.reportOption, reportReason === r && styles.reportOptionActive]}
                      onPress={() => setReportReason(r)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.radio, reportReason === r && styles.radioActive]}>
                        {reportReason === r && <View style={styles.radioDot} />}
                      </View>
                      <Text
                        style={[
                          styles.reportOptionText,
                          reportReason === r && styles.reportOptionTextActive,
                        ]}
                      >
                        {r === 'incorrect'
                          ? 'Incorrect answer'
                          : r === 'incomplete'
                          ? 'Incomplete explanation'
                          : r === 'formatting'
                          ? 'Formatting / math issue'
                          : 'Other'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {reportReason && (
                    <TextInput
                      placeholder={
                        reportReason === 'other'
                          ? 'Describe what is wrong (required)'
                          : 'Optional details (max 500)'
                      }
                      placeholderTextColor={COLORS.textSubtle}
                      style={styles.reportInput}
                      multiline
                      maxLength={500}
                      value={reportMsg}
                      onChangeText={setReportMsg}
                    />
                  )}
                  <TouchableOpacity
                    style={[
                      styles.reportSubmitBtn,
                      (!reportReason ||
                        (reportReason === 'other' && reportMsg.trim().length < 4) ||
                        reportSubmitting) &&
                        styles.reportSubmitBtnDisabled,
                    ]}
                    disabled={
                      !reportReason ||
                      (reportReason === 'other' && reportMsg.trim().length < 4) ||
                      reportSubmitting
                    }
                    onPress={handleReportSubmit}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.reportSubmitText}>
                      {reportSubmitting ? 'Submitting…' : 'Submit report'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reportCancelBtn}
                    onPress={() => setShowReport(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reportCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
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
  badgesCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: COLORS.cardSecondary,
  },
  pillText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  yearPill: {
    borderColor: COLORS.secondary,
  },
  yearPillText: {
    color: COLORS.secondary,
  },
  qNumPill: {
    borderColor: COLORS.border,
  },
  qNumPillText: {
    color: COLORS.text,
  },
  marksPill: {
    borderColor: COLORS.border,
  },
  marksPillText: {
    color: COLORS.textMuted,
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
    gap: 12,
  },
  iconButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solutionSection: {
    backgroundColor: COLORS.cardSecondary,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  solutionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  solutionBody: {
    paddingTop: 2,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
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
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  reportText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
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
    marginHorizontal: 14,
    marginBottom: 12,
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
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  reportHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 14,
  },
  reportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 8,
    backgroundColor: COLORS.cardSecondary,
  },
  reportOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioActive: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
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
});
