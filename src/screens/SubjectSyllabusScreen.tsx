import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  RefreshControl,
  Modal,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { useSyllabusSubject, useTopicQuestionCounts } from '../api/queries';
import { SyllabusModule, SyllabusSubject, Topic } from '../types/syllabus';
import { adoptRenamedSubject, getDoneTopicsIn, setTopicDone, subscribeProgressFor } from '../db/syllabusProgress';
import { ScreenError, ScreenEmpty } from '../components/ScreenState';
import { CircleLoader } from '../components/CircleLoader';
import { userMessage } from '../utils/netError';
import { useContainerStyle } from '../components/ScreenContainer';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { useAdminAccess } from '../admin/useAdminAccess';
import { can } from '../admin/adminLogic';
import { ManageTopicSheet } from '../components/ManageTopicSheet';
import { ManageModuleSheet } from '../components/ManageModuleSheet';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Namespaced so two subjects reusing topic id "t1" never collide in storage. */
const topicKey = (moduleId: string, topicId: string) => `${moduleId}:${topicId}`;

/**
 * A subject's syllabus: modules collapse and expand, topics sit inside them.
 *
 * A topic is one line: the tick and title take the left as a single large hit
 * target. A notes icon sits at the right only when the topic actually has
 * notes (topic.hasNotes, a cheap flag the subject payload always carries -
 * see syllabusService.js's topicOut) - tapping it opens TopicNotesScreen,
 * the topic's markdown+LaTeX study writeup. No icon for a topic without
 * notes is deliberate: a button that opens an empty page is worse UX than no
 * button at all. Long titles wrap and the icon stays centred against them.
 *
 * __DEV__ shows the icon for every topic regardless of hasNotes (dimmed for
 * ones without notes) - lets whoever is testing jump straight into
 * TopicNotesScreen and exercise the fetch/empty-state path without an admin
 * having to write a note first. Real installs keep the hasNotes gate.
 *
 * Fetched whole via /syllabus/subjects/:slug, through the read-through cache.
 */
export const SubjectSyllabusScreen = () => {
  const frame = useContainerStyle('read', false);
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { subjectId } = route.params ?? {};

  const subjectQ = useSyllabusSubject(subjectId);
  const subject: SyllabusSubject | null = subjectQ.data ?? null;
  // How many past-paper questions an admin has linked to each topic. A missing or
  // failed answer simply means no PYQ icons; it is never an error on this screen.
  const countsQ = useTopicQuestionCounts(subject?.id);
  const topicCounts = countsQ.data?.topics;
  // Only an error when there is nothing (not even a persisted copy) to show.
  const error =
    subjectQ.isError && !subjectQ.data ? userMessage(subjectQ.error, 'Could not load this subject.') : null;
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [copiedTopic, setCopiedTopic] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Admin inline editing (SRS-admin-syllabus-notes-app.md): same screen
  // students read on. The server re-checks every grant; these only gate UI.
  const admin = useAdminAccess();
  const canAddTree = can(admin.tools, 'manage_syllabus', 'create') || can(admin.tools, 'manage_syllabus', '*');
  const canEditTree = can(admin.tools, 'manage_syllabus', 'update') || can(admin.tools, 'manage_syllabus', '*');
  const [topicSheet, setTopicSheet] = useState<{ module: SyllabusModule; topic: Topic | null } | null>(null);
  const [moduleSheet, setModuleSheet] = useState<{ module: SyllabusModule | null } | null>(null);

  const handleCopyTopic = useCallback(async (topicTitle: string) => {
    try {
      await Clipboard.setStringAsync(topicTitle);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setCopiedTopic(topicTitle);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedTopic(null);
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Keep all modules collapsed by default; user taps to expand.
  useEffect(() => {
    setOpen(new Set());
  }, [subjectId]);

  // Progress is local-first (and synced to the account when signed in). Re-read
  // done topics when the subject loads, whenever this screen regains focus
  // (marking a topic complete from TopicNotesScreen writes to the same store),
  // and when a sync pulls changes made on another device. Records for topics
  // missing from this syllabus are left in storage, just not shown - the
  // syllabus on screen can be a stale offline copy.
  useFocusEffect(
    useCallback(() => {
      if (!subject) return;
      const validKeys = new Set<string>();
      for (const m of subject.modules || []) {
        for (const t of m.topics || []) {
          validKeys.add(topicKey(m.id, t.id));
        }
      }
      const load = () => void getDoneTopicsIn(subject.id, validKeys).then(setDone);
      void adoptRenamedSubject(subject.id, validKeys).then(load);
      load();
      return subscribeProgressFor([subject.id], load);
    }, [subject])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await subjectQ.refetch();
    setRefreshing(false);
  };

  const toggleModule = useCallback((moduleId: string) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }, []);

  const toggleDone = useCallback(
    (moduleId: string, topic: Topic) => {
      if (!subject) return;
      const key = topicKey(moduleId, topic.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDone((prev) => {
        const next = new Set(prev);
        const nowDone = !next.has(key);
        if (nowDone) next.add(key);
        else next.delete(key);
        // Written straight through rather than on unmount - a student who
        // backgrounds the app mid-revision should not lose their ticks. Only
        // this one topic is written, so two screens cannot overwrite each other.
        void setTopicDone(subject.id, key, nowDone);
        return next;
      });
    },
    [subject]
  );

  const openTopicNotes = useCallback(
    (module: SyllabusModule, topic: Topic) => {
      if (!subject) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Flattened in module -> topic order, notes-only - this is what lets
      // TopicNotesScreen offer prev/next across every topic that has notes,
      // the same way QuestionDetailScreen steps through a paper. Only id and
      // title travel here; the notes body itself is fetched per-topic on
      // demand, same as the initial open.
      const notesList = subject.modules.flatMap((m) =>
        m.topics
          .filter((t) => t.hasNotes)
          .map((t) => ({ id: t.id, title: t.title, moduleId: m.id, moduleName: m.title }))
      );
      navigation.navigate('TopicNotes', {
        topic,
        moduleId: module.id,
        moduleName: module.title,
        subjectId,
        subjectName: subject.name,
        semesterId: subject.semester ? `sem-${subject.semester}` : undefined,
        notesList,
      });
    },
    [navigation, subject, subjectId]
  );

  const openTopicQuestions = useCallback(
    (module: SyllabusModule, topic: Topic) => {
      if (!subject) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('TopicQuestions', {
        subjectId,
        subjectName: subject.name,
        topicId: topic.id,
        topicTitle: topic.title,
        moduleId: module.id,
        moduleName: module.title,
        semesterId: subject.semester ? `sem-${subject.semester}` : undefined,
      });
    },
    [navigation, subject, subjectId]
  );

  if (!subjectId) {
    return (
      <View style={styles.centerContainer}>
        <ScreenEmpty message="No subject selected." />
      </View>
    );
  }

  if (!subject) {
    return (
      <View style={styles.centerContainer}>
        {error ? (
          <ScreenError message={error} onRetry={() => void subjectQ.refetch()} />
        ) : (
          <CircleLoader color={COLORS.primary} dotSize={6} size={40} />
        )}
      </View>
    );
  }

  const renderModule = (m: SyllabusModule) => {
    const expanded = open.has(m.id);
    const mDone = m.topics.filter((t) => done.has(topicKey(m.id, t.id))).length;
    const allDone = mDone === m.topics.length && m.topics.length > 0;

    return (
      <View key={m.id} style={[styles.modCard, allDone && styles.modCardDone]}>
        <TouchableOpacity
          style={styles.modHead}
          activeOpacity={0.7}
          onPress={() => toggleModule(m.id)}
        >
          <View style={styles.modTitleWrap}>
            {subject.kind === 'theory' && <Text style={styles.modNum}>Module {m.number}</Text>}
            <Text style={styles.modTitle}>{m.title}</Text>
            <Text style={styles.modCount}>
              {mDone} of {m.topics.length} topics
            </Text>
          </View>
          {allDone && (
            <Feather name="check-circle" size={18} color={COLORS.secondary} style={{ marginRight: 4 }} />
          )}
          {canEditTree && (
            <TouchableOpacity
              onPress={() => setModuleSheet({ module: m })}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={{ padding: 6 }}
              accessibilityLabel={`Edit ${m.title}`}
              accessibilityHint="Rename or delete this module"
            >
              <Feather name="edit-3" size={15} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>

        {expanded &&
          m.topics.map((t) => {
            const isDone = done.has(topicKey(m.id, t.id));
            const isCopied = copiedTopic === t.title;
            return (
              <View key={t.id} style={[styles.topicRow, isCopied && styles.topicRowCopied]}>
                <TouchableOpacity
                  style={styles.tickZone}
                  activeOpacity={0.6}
                  onPress={() => toggleDone(m.id, t)}
                  onLongPress={() => handleCopyTopic(t.title)}
                  delayLongPress={350}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isDone }}
                  accessibilityLabel={`Mark ${t.title} as done`}
                  accessibilityHint="Long press to copy topic title"
                >
                  <View style={[styles.bubble, isDone && styles.bubbleOn]}>
                    {isDone && <Feather name="check" size={13} color={COLORS.card} />}
                  </View>
                  <Text style={[styles.topicText, isDone && styles.topicTextDone]}>
                    {t.title}
                  </Text>
                  {isCopied && (
                    <View style={styles.inlineCopiedBadge}>
                      <Feather name="check" size={10} color={COLORS.primary} />
                      <Text style={styles.inlineCopiedText}>Copied</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.actionsWrap}>
                  {(topicCounts?.[t.id] ?? 0) > 0 && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.pyqBtn, isDone && styles.actionBtnDone]}
                      onPress={() => openTopicQuestions(m, t)}
                      activeOpacity={0.7}
                      accessibilityLabel={`${topicCounts?.[t.id]} past paper questions on ${t.title}`}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Feather name="file-text" size={16} color={COLORS.secondary} />
                      <Text style={styles.pyqCount}>{topicCounts?.[t.id]}</Text>
                    </TouchableOpacity>
                  )}

                  {(t.hasNotes || __DEV__) && (
                    <TouchableOpacity
                      style={[styles.actionBtn, isDone && styles.actionBtnDone]}
                      onPress={() => openTopicNotes(m, t)}
                      activeOpacity={0.7}
                      accessibilityLabel={`Open notes for ${t.title}`}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Feather
                        name="book-open"
                        size={17}
                        color={t.hasNotes ? COLORS.primary : COLORS.textSubtle}
                      />
                    </TouchableOpacity>
                  )}
                  {canEditTree && (
                    <TouchableOpacity
                      style={[styles.actionBtn, isDone && styles.actionBtnDone]}
                      onPress={() => setTopicSheet({ module: m, topic: t })}
                      activeOpacity={0.7}
                      accessibilityLabel={`Edit topic ${t.title}`}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Feather name="edit-3" size={15} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
          {canAddTree && (
            <TouchableOpacity
              onPress={() => setTopicSheet({ module: m, topic: null })}
              activeOpacity={0.7}
              style={styles.addRow}
              accessibilityLabel={`Add topic to ${m.title}`}
            >
              <Feather name="plus" size={14} color={COLORS.primary} />
              <Text style={styles.addRowText}>Add topic</Text>
            </TouchableOpacity>
          )}
      </View>
    );
  };

  const totalTopics = subject.modules.reduce((sum, m) => sum + m.topics.length, 0);
  const completedTopics = subject.modules.reduce(
    (sum, m) => sum + m.topics.filter((t) => done.has(topicKey(m.id, t.id))).length,
    0
  );
  const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[frame, { paddingBottom: Math.max(insets.bottom, 16), paddingTop: 6 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Signed out: persistent, non-dismissible login prompt so ticks are saved. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <SyncStatusBar dismissible={false} />
        </View>
        {/* Live Syllabus Progress Meter */}
        {totalTopics > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeaderRow}>
              <View style={styles.progressTitleWrap}>
                <Feather
                  name="check-circle"
                  size={13}
                  color={progressPercent === 100 ? COLORS.secondary : COLORS.primary}
                />
                <Text style={styles.progressKicker}>SYLLABUS PROGRESS</Text>
              </View>
              <Text style={styles.progressPercentText}>{progressPercent}%</Text>
            </View>
            <Text style={styles.progressSummary}>
              {completedTopics} of {totalTopics} topics done
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercent}%` },
                  progressPercent === 100 && styles.progressFillDone,
                ]}
              />
            </View>
          </View>
        )}

        {subject.modules.length === 0 ? (
          <ScreenEmpty message="No modules have been typed up for this subject yet." />
        ) : (
          subject.modules.map(renderModule)
        )}
        {canAddTree && (
          <TouchableOpacity
            onPress={() => setModuleSheet({ module: null })}
            activeOpacity={0.7}
            style={styles.addModuleBtn}
            accessibilityLabel="Add module"
          >
            <Feather name="plus" size={15} color={COLORS.primary} />
            <Text style={styles.addRowText}>Add module</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Admin sheets: same screen, pencil-gated. */}
      <Modal visible={!!topicSheet} animationType="slide" onRequestClose={() => setTopicSheet(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {topicSheet && (
              <ManageTopicSheet
                subjectId={subject.id}
                moduleId={topicSheet.module.id}
                moduleTitle={topicSheet.module.title}
                topic={topicSheet.topic}
                linkCount={topicCounts?.[topicSheet.topic?.id ?? ''] ?? 0}
                onSaved={() => {
                  setTopicSheet(null);
                  void subjectQ.refetch();
                }}
                onClose={() => setTopicSheet(null)}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={!!moduleSheet} animationType="slide" onRequestClose={() => setModuleSheet(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {moduleSheet && (
              <ManageModuleSheet
                subjectId={subject.id}
                module={moduleSheet.module}
                topicCount={moduleSheet.module?.topics.length ?? 0}
                notesCount={moduleSheet.module?.topics.filter((t) => t.hasNotes).length ?? 0}
                nextNumber={(subject.modules.reduce((n, m) => Math.max(n, m.number), 0) || 0) + 1}
                onSaved={() => {
                  setModuleSheet(null);
                  void subjectQ.refetch();
                }}
                onClose={() => setModuleSheet(null)}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Floating toast notification on copy */}
      {copiedTopic && (
        <View
          style={[styles.toastContainer, { bottom: insets.bottom + 16 }]}
          pointerEvents="none"
        >
          <View style={styles.toastCard}>
            <Feather name="copy" size={13} color={COLORS.primary} />
            <Text style={styles.toastText} numberOfLines={1}>
              Copied "{copiedTopic}"
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // PYQ icon with the number of linked past-paper questions beside it.
  pyqBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pyqCount: { fontFamily: FONTS.bodyBold, fontSize: 12, color: COLORS.secondary },
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressKicker: {
    fontFamily: FONTS.displayBold,
    fontSize: 10.5,
    color: COLORS.textSubtle,
    letterSpacing: 1.2,
  },
  progressPercentText: {
    fontFamily: FONTS.display,
    fontSize: 26,
    letterSpacing: -0.8,
    color: COLORS.secondary,
  },
  progressSummary: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: COLORS.text,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.cardSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 3,
  },
  progressFillDone: {
    backgroundColor: COLORS.secondary,
  },
  modHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 64,
  },
  modCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modCardDone: { borderColor: COLORS.secondary },
  modTitleWrap: { flex: 1 },
  modNum: {
    fontFamily: FONTS.displayBold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
    marginBottom: 2,
  },
  modTitle: { fontFamily: FONTS.displayBold, fontSize: 14.5, lineHeight: 19, color: COLORS.text },
  modCount: { fontFamily: FONTS.bodyMedium, fontSize: 11.5, color: COLORS.textSubtle, marginTop: 3 },

  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingRight: 8,
    minHeight: 50,
  },
  tickZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 11,
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: -4,
  },
  actionBtn: {
    padding: 8,
  },
  actionBtnDone: { opacity: 0.4 },
  bubble: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.borderDashed,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleOn: { borderColor: COLORS.secondary, backgroundColor: COLORS.secondary },
  topicText: { flex: 1, fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19, color: COLORS.text },
  topicTextDone: { color: COLORS.textSubtle },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  addRowText: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.primary },
  addModuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  bar: { height: 4, borderRadius: 2, backgroundColor: COLORS.borderLight, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.secondary },
  topicRowCopied: {
    backgroundColor: COLORS.primaryLight,
  },
  inlineCopiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    marginLeft: 6,
  },
  inlineCopiedText: {
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    color: COLORS.primary,
  },
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.text,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    maxWidth: '92%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
      },
    }),
  },
  toastText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    color: '#ffffff',
    flexShrink: 1,
  },
});
