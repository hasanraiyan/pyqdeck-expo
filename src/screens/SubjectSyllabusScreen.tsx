import React, { useCallback, useEffect, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { getSyllabusSubject } from '../api';
import { SyllabusModule, SyllabusSubject, Topic, topicCountOf } from '../types/syllabus';
import { getDoneTopics, saveDoneTopics } from '../db/syllabusProgress';
import { DoneStamp } from '../components/Badge';
import { ScreenError, ScreenEmpty } from '../components/ScreenState';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Namespaced so two subjects reusing topic id "t1" never collide in storage. */
const topicKey = (moduleId: string, topicId: string) => `${moduleId}:${topicId}`;

/**
 * A subject's syllabus: modules collapse and expand, topics sit inside them.
 *
 * A topic is one line: the tick and title take the left as a single large hit
 * target, and a notes icon sits at the right - tapping it opens
 * TopicNotesScreen, the topic's markdown+LaTeX study writeup (with an
 * Ask AI fallback for topics that don't have one yet). Long titles wrap and
 * the icon stays centred against them.
 *
 * Fetched whole via /syllabus/subjects/:slug, through the read-through cache.
 */
export const SubjectSyllabusScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { semester = 5, subjectId } = route.params ?? {};

  const [subject, setSubject] = useState<SyllabusSubject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (force = false) => {
      if (!subjectId) return;
      try {
        setError(null);
        const next = await getSyllabusSubject(subjectId, force);
        setSubject(next);
        // Progress is device-local and read in the same pass so a returning
        // student sees their ticks immediately.
        const d = await getDoneTopics(next.id);
        setDone(d);
        // Open the first module that still has unfinished topics - that is
        // almost always where the student left off.
        const firstOpen = next.modules.find((m) =>
          m.topics.some((t) => !d.has(topicKey(m.id, t.id)))
        );
        setOpen(new Set([firstOpen?.id ?? next.modules[0]?.id].filter(Boolean) as string[]));
      } catch (e: any) {
        setError(e?.message || 'Could not load this subject.');
      }
    },
    [subjectId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
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
        if (next.has(key)) next.delete(key);
        else next.add(key);
        // Written straight through rather than on unmount - a student who
        // backgrounds the app mid-revision should not lose their ticks.
        void saveDoneTopics(subject.id, next);
        return next;
      });
    },
    [subject]
  );

  const openTopicNotes = useCallback(
    (topic: Topic) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('TopicNotes', {
        topic,
        subjectId,
        subjectName: subject?.name,
        semester,
      });
    },
    [navigation, subject, subjectId, semester]
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
          <ScreenError message={error} onRetry={() => load(true)} />
        ) : (
          <ActivityIndicator size="large" color={COLORS.primary} />
        )}
      </View>
    );
  }

  const total = topicCountOf(subject);
  const doneCount = done.size;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const unit = subject.kind === 'lab' ? 'experiments' : 'topics';

  const renderModule = (m: SyllabusModule) => {
    const expanded = open.has(m.id);
    const mDone = m.topics.filter((t) => done.has(topicKey(m.id, t.id))).length;
    const allDone = mDone === m.topics.length && m.topics.length > 0;

    return (
      <View key={m.id}>
        <TouchableOpacity
          style={[styles.modHead, expanded && styles.modHeadOpen]}
          activeOpacity={0.7}
          onPress={() => toggleModule(m.id)}
        >
          <Feather
            name={expanded ? 'chevron-down' : 'chevron-right'}
            size={18}
            color={COLORS.textMuted}
          />
          <View style={styles.modTitleWrap}>
            {subject.kind === 'theory' && <Text style={styles.modNum}>Module {m.number}</Text>}
            <Text style={styles.modTitle}>{m.title}</Text>
          </View>
          {allDone ? (
            <DoneStamp />
          ) : (
            <Text style={styles.modCount}>
              {mDone}/{m.topics.length}
            </Text>
          )}
        </TouchableOpacity>

        {expanded &&
          m.topics.map((t) => {
            const isDone = done.has(topicKey(m.id, t.id));
            return (
              <View key={t.id} style={styles.topicRow}>
                <TouchableOpacity
                  style={styles.tickZone}
                  activeOpacity={0.6}
                  onPress={() => toggleDone(m.id, t)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isDone }}
                  accessibilityLabel={`Mark ${t.title} as done`}
                >
                  <View style={[styles.bubble, isDone && styles.bubbleOn]}>
                    {isDone && <Feather name="check" size={13} color={COLORS.card} />}
                  </View>
                  <Text style={[styles.topicText, isDone && styles.topicTextDone]}>
                    {t.title}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.notesBtn, isDone && styles.notesBtnDone]}
                  onPress={() => openTopicNotes(t)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Open notes for ${t.title}`}
                >
                  <Feather name="file-text" size={17} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            );
          })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.head}>
          <View style={styles.badgeRow}>
            <Text style={styles.code}>{subject.code}</Text>
            <Text style={styles.kindTag}>
              {subject.kind === 'lab' ? 'Laboratory' : 'Theory'}
            </Text>
          </View>
          <Text style={styles.title}>{subject.name}</Text>
          <View style={styles.headProg}>
            <View style={[styles.bar, { flex: 1 }]}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.headFrac}>
              {doneCount} / {total}
            </Text>
          </View>
          <Text style={styles.sub}>
            {doneCount === total && total > 0
              ? `All ${total} ${unit} marked done.`
              : `${total - doneCount} ${unit} left.`}
          </Text>
        </View>

        {subject.modules.length === 0 ? (
          <ScreenEmpty message="No modules have been typed up for this subject yet." />
        ) : (
          subject.modules.map(renderModule)
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  code: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  kindTag: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.textMuted,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 25,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 31,
    letterSpacing: -0.5,
  },
  headProg: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  headFrac: { fontFamily: FONTS.mono, fontSize: 11, fontWeight: '600', color: COLORS.secondary },
  sub: { fontSize: 12.5, color: COLORS.textMuted, marginTop: 6 },

  modHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 58,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  modHeadOpen: { backgroundColor: COLORS.cardSecondary },
  modTitleWrap: { flex: 1 },
  modNum: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
    marginBottom: 2,
  },
  modTitle: { fontSize: 14.5, lineHeight: 19, color: COLORS.text },
  modCount: { fontFamily: FONTS.mono, fontSize: 11.5, color: COLORS.textSubtle },

  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    paddingRight: 10,
    minHeight: 52,
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
  notesBtn: { padding: 8, marginRight: -8 },
  notesBtnDone: { opacity: 0.4 },
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
  topicText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: COLORS.text },
  topicTextDone: { color: COLORS.textSubtle },
  bar: { height: 4, borderRadius: 2, backgroundColor: COLORS.borderLight, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.secondary },
});
