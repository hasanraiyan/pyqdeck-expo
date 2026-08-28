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
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import { QuestionSummary, Solution } from '../types';
import { getSolution, voteSolution, reportSolution } from '../api';
import { getVoterId } from '../utils/voterId';
import { getMyVote, setMyVote } from '../utils/votes';
import { COLORS, FONTS } from '../theme/colors';
import { Badge, MarksBadge, AskAiBadge, YearBadge } from './Badge';
import { SolutionSkeleton } from './Skeleton';
import { cleanMarkdown } from '../utils/responsive';
import { buildQuestionUrl } from '../utils/links';
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
  const [myVote, setMyVoteState] = useState<1 | -1 | null>(null);
  const [voteCounts, setVoteCounts] = useState({ upvotes: 0, downvotes: 0 });
  const [isVoting, setIsVoting] = useState(false);
  const myVoteRef = useRef<1 | -1 | null>(null);
  const voteCountsRef = useRef({ upvotes: 0, downvotes: 0 });
  const pendingVoteRef = useRef<1 | -1 | 0 | null>(null);
  const actionIdRef = useRef(0);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<'incorrect' | 'incomplete' | 'formatting' | 'other' | null>(null);
  const [reportMsg, setReportMsg] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

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

  useEffect(() => {
    if (solution) setVoteCounts({ upvotes: solution.upvotes ?? 0, downvotes: solution.downvotes ?? 0 });
  }, [solution]);

  useEffect(() => {
    if (expanded && question.questionId) getMyVote(question.questionId).then(setMyVoteState);
  }, [expanded, question.questionId]);

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
      const voterId = await getVoterId();
      const result = await voteSolution(subjectId, question.questionId, voterId, nextValue);
      if (actionId !== actionIdRef.current) return;
      const clamped = { upvotes: Math.max(0, result.upvotes ?? 0), downvotes: Math.max(0, result.downvotes ?? 0) };
      setVoteCounts(clamped);
      voteCountsRef.current = clamped;
      await setMyVote(question.questionId, nextValue);
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

  const handleReportSubmit = async () => {
    if (!reportReason || reportSubmitting) return;
    if (reportReason === 'other' && reportMsg.trim().length < 4) return;
    setReportSubmitting(true);
    try {
      const voterId = await getVoterId();
      await reportSolution(subjectId, question.questionId, voterId, reportReason, reportMsg.trim() || undefined);
      setReported(true);
      setShowReport(false);
      setReportReason(null);
      setReportMsg('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
                  <View style={styles.voteRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <TouchableOpacity style={[styles.voteButton, isVoting && { opacity: 0.6 }]} activeOpacity={0.6} onPress={() => handleVote(1)}>
                        <Feather name="thumbs-up" size={14} color={myVote === 1 ? COLORS.primary : COLORS.textMuted} />
                        <Text style={[styles.voteCount, myVote === 1 && styles.voteCountActive]}>{voteCounts.upvotes}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.voteButton, isVoting && { opacity: 0.6 }]} activeOpacity={0.6} onPress={() => handleVote(-1)}>
                        <Feather name="thumbs-down" size={14} color={myVote === -1 ? COLORS.primary : COLORS.textMuted} />
                        <Text style={[styles.voteCount, myVote === -1 && styles.voteCountActive]}>{voteCounts.downvotes}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={[styles.reportBtn, reported && { opacity: 0.6 }]} activeOpacity={0.6} onPress={() => setShowReport(true)} disabled={reported}>
                      <Feather name="flag" size={12} color={reported ? COLORS.primary : COLORS.textMuted} />
                      <Text style={[styles.reportText, reported && { color: COLORS.primary }]}>{reported ? 'Reported' : 'Report'}</Text>
                    </TouchableOpacity>
                  </View>
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
      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <TouchableWithoutFeedback onPress={() => setShowReport(false)}>
          <View style={styles.reportOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.reportSheet, { paddingBottom: 24 }]}>
                <View style={styles.reportHandle} />
                <Text style={styles.reportTitle}>Report solution</Text>
                <Text style={styles.reportSubtitle}>What’s wrong? Anyone anonymous can report — DB only.</Text>
                {(['incorrect','incomplete','formatting','other'] as const).map((r) => (
                  <TouchableOpacity key={r} style={[styles.reportOption, reportReason===r && styles.reportOptionActive]} onPress={() => setReportReason(r)} activeOpacity={0.7}>
                    <View style={[styles.radio, reportReason===r && styles.radioActive]}>{reportReason===r && <View style={styles.radioDot} />}</View>
                    <Text style={[styles.reportOptionText, reportReason===r && styles.reportOptionTextActive]}>{r==='incorrect' ? 'Incorrect answer' : r==='incomplete' ? 'Incomplete explanation' : r==='formatting' ? 'Formatting / math issue' : 'Other'}</Text>
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
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: COLORS.card,
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
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});
