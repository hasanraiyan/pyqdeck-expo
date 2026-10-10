import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getNoteVotes, voteNote, reportNote, type NoteVotes, type NoteReportReason } from '../api';
import { qk } from '../api/queryKeys';
import { COLORS, FONTS } from '../theme/colors';
import { useRequireAuth } from '../auth/useRequireAuth';
import { useDialogLayout } from '../utils/dialog';
import { userMessage } from '../utils/netError';
import { shareTopic } from '../utils/links';
import { logEvent } from '../utils/analytics';

const REASONS: { key: NoteReportReason; label: string }[] = [
  { key: 'incorrect', label: 'Incorrect information' },
  { key: 'incomplete', label: 'Incomplete notes' },
  { key: 'outdated', label: 'Outdated / not in syllabus' },
  { key: 'offensive', label: 'Offensive or inappropriate' },
  { key: 'other', label: 'Other' },
];

type Props = {
  subjectId: string;
  topicId: string;
  topicTitle: string;
  subjectName?: string;
};

/**
 * Thumbs up/down, report and share for one topic's notes - the notes-screen
 * counterpart of the vote/report row under a worked solution. Voting and
 * reporting need an account (guard() parks the tap, opens sign-in, replays it);
 * sharing and reading the totals do not.
 */
export const NoteFeedbackBar = ({ subjectId, topicId, topicTitle, subjectName }: Props) => {
  const queryClient = useQueryClient();
  const { guard, isSignedIn } = useRequireAuth();
  const insets = useSafeAreaInsets();
  const dlg = useDialogLayout();
  const signedIn = Boolean(isSignedIn);

  const key = qk.noteVotes(subjectId, topicId, signedIn);
  const votesQ = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getNoteVotes(subjectId, topicId, signal),
    staleTime: 30_000,
  });
  const votes: NoteVotes = votesQ.data ?? { topicId, upvotes: 0, downvotes: 0, myVote: 0 };

  // One request at a time per bar; a tap during the flight is ignored rather
  // than queued, which is enough for a control tapped far less often than
  // the solution list's.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const castVote = useCallback(
    async (value: 1 | -1) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      const prev = queryClient.getQueryData<NoteVotes>(key) ?? votes;
      const next: 1 | -1 | 0 = prev.myVote === value ? 0 : value;
      const optimistic: NoteVotes = {
        ...prev,
        myVote: next,
        upvotes: Math.max(
          0,
          prev.upvotes - (prev.myVote === 1 ? 1 : 0) + (next === 1 ? 1 : 0)
        ),
        downvotes: Math.max(
          0,
          prev.downvotes - (prev.myVote === -1 ? 1 : 0) + (next === -1 ? 1 : 0)
        ),
      };
      queryClient.setQueryData(key, optimistic);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (next !== 0) logEvent('vote_notes', { direction: next === 1 ? 'up' : 'down' });
      try {
        const result = await voteNote(subjectId, topicId, next);
        queryClient.setQueryData(key, result);
      } catch {
        queryClient.setQueryData(key, prev);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [key, queryClient, subjectId, topicId, votes]
  );

  const handleVote = (value: 1 | -1) => guard(() => void castVote(value));

  // --- report sheet ---
  const [showReport, setShowReport] = useState(false);
  const [reason, setReason] = useState<NoteReportReason | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const closeReport = () => {
    Keyboard.dismiss();
    setShowReport(false);
    setError(null);
  };

  const canSubmit = Boolean(reason) && !(reason === 'other' && message.trim().length < 4);

  const submitReport = async () => {
    if (!reason || !canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await reportNote(subjectId, topicId, reason, message.trim() || undefined);
      setReported(true);
      setShowReport(false);
      setReason(null);
      setMessage('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(
        e?.message?.includes('already reported')
          ? 'You have already reported these notes.'
          : userMessage(e, 'Could not send your report.')
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    logEvent('share_notes', { subject: subjectId });
    void shareTopic({ subjectId, topicId, title: topicTitle, subjectName });
  };

  return (
    <>
      <View style={styles.row}>
        <View style={styles.group}>
          <TouchableOpacity
            style={[styles.voteButton, busy && styles.dim]}
            activeOpacity={0.6}
            onPress={() => handleVote(1)}
            accessibilityLabel="Helpful notes"
          >
            <Feather
              name="thumbs-up"
              size={15}
              color={votes.myVote === 1 ? COLORS.primary : COLORS.textMuted}
            />
            <Text style={[styles.count, votes.myVote === 1 && styles.countActive]}>
              {votes.upvotes}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.voteButton, busy && styles.dim]}
            activeOpacity={0.6}
            onPress={() => handleVote(-1)}
            accessibilityLabel="Not helpful"
          >
            <Feather
              name="thumbs-down"
              size={15}
              color={votes.myVote === -1 ? COLORS.primary : COLORS.textMuted}
            />
            <Text style={[styles.count, votes.myVote === -1 && styles.countActive]}>
              {votes.downvotes}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.6}
            onPress={handleShare}
            accessibilityLabel="Share these notes"
          >
            <Feather name="share-2" size={13} color={COLORS.textMuted} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.action, reported && styles.dim]}
            activeOpacity={0.6}
            disabled={reported}
            onPress={() => guard(() => setShowReport(true), 'report')}
            accessibilityLabel="Report these notes"
          >
            <Feather name="flag" size={12} color={reported ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.actionText, reported && { color: COLORS.primary }]}>
              {reported ? 'Reported' : 'Report'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showReport}
        transparent
        animationType={dlg.animationType}
        statusBarTranslucent
        onRequestClose={closeReport}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <TouchableWithoutFeedback onPress={closeReport}>
            <View style={[styles.overlay, dlg.overlay]}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View
                  style={[
                    styles.sheet,
                    { paddingBottom: Math.max(insets.bottom, 16) + 16 },
                    dlg.sheet,
                  ]}
                >
                  <View style={styles.handle} />
                  <ScrollView
                    ref={scrollRef}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                  >
                    <Text style={styles.title}>Report notes</Text>
                    <Text style={styles.subtitle}>
                      What’s wrong with these notes? Help us improve them.
                    </Text>
                    {REASONS.map((r) => (
                      <TouchableOpacity
                        key={r.key}
                        style={[styles.option, reason === r.key && styles.optionActive]}
                        onPress={() => {
                          setReason(r.key);
                          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radio, reason === r.key && styles.radioActive]}>
                          {reason === r.key && <View style={styles.radioDot} />}
                        </View>
                        <Text
                          style={[styles.optionText, reason === r.key && styles.optionTextActive]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {reason && (
                      <TextInput
                        placeholder={
                          reason === 'other'
                            ? 'Describe what is wrong (required)'
                            : 'Optional details (max 500)'
                        }
                        placeholderTextColor={COLORS.textSubtle}
                        value={message}
                        onChangeText={setMessage}
                        onFocus={() =>
                          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)
                        }
                        multiline
                        maxLength={500}
                        style={styles.input}
                      />
                    )}
                    {error && <Text style={styles.errorText}>{error}</Text>}
                    <TouchableOpacity
                      style={[
                        styles.submitBtn,
                        (!canSubmit || submitting) && styles.submitBtnDisabled,
                      ]}
                      onPress={submitReport}
                      disabled={!canSubmit || submitting}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.submitText}>
                        {submitting ? 'Submitting…' : 'Submit report'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={closeReport} activeOpacity={0.7}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dim: { opacity: 0.6 },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  count: { fontFamily: FONTS.displayBold, fontSize: 12, color: COLORS.textMuted },
  countActive: { color: COLORS.primary },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionText: { fontFamily: FONTS.displayBold, fontSize: 12, color: COLORS.textMuted },
  kav: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.card,
    maxHeight: '85%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 12.5, color: COLORS.textMuted, marginBottom: 14 },
  option: {
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
  optionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  optionText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  optionTextActive: { color: COLORS.primary, fontWeight: '600' },
  input: {
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
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { backgroundColor: COLORS.border },
  submitText: { fontFamily: FONTS.displayBold, fontSize: 13, color: '#fff' },
  errorText: {
    fontSize: 12.5,
    lineHeight: 17,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  cancelText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
});
