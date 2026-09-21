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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { COLORS, FONTS } from '../theme/colors';
import { getSyllabusSubject } from '../api';
import { SyllabusModule, SyllabusSubject, Topic } from '../types/syllabus';
import { getDoneTopics, saveDoneTopics } from '../db/syllabusProgress';
import { DoneStamp } from '../components/Badge';
import { ScreenError, ScreenEmpty } from '../components/ScreenState';
import { WaveLoader } from '../components/WaveLoader';

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
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { subjectId } = route.params ?? {};

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
        // Keep all modules collapsed by default; user taps to expand.
        setOpen(new Set());
      } catch (e: any) {
        setError(e?.message || 'Could not load this subject.');
      }
    },
    [subjectId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Re-read done topics (not a full network refetch) whenever this screen
  // regains focus - marking a topic complete from TopicNotesScreen writes
  // straight to the same AsyncStorage key, and this is what picks that up
  // on the way back without a pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      if (!subject) return;
      void getDoneTopics(subject.id).then(setDone);
    }, [subject])
  );

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
        notesList,
      });
    },
    [navigation, subject, subjectId]
  );

  const openYouTubeSearch = useCallback(
    async (topicTitle: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Using Google Video search with site:youtube.com prevents Android/iOS OS App Link intent
      // from intercepting youtube.com and forcing open the native YouTube app.
      // This ensures the in-app browser sheet loads inside the app so the student never leaves the ecosystem.
      const query = subject?.name ? `${topicTitle} ${subject.name} lecture` : `${topicTitle} lecture`;
      const url = `https://www.google.com/search?q=${encodeURIComponent(query + ' site:youtube.com')}&tbm=vid`;
      try {
        await WebBrowser.openBrowserAsync(url, {
          toolbarColor: COLORS.card,
          controlsColor: COLORS.primary,
          secondaryToolbarColor: COLORS.background,
          showTitle: true,
          enableBarCollapsing: true,
        });
      } catch {
        Linking.openURL(url).catch((err) => {
          console.warn('Could not open video search:', err);
        });
      }
    },
    [subject]
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
          <WaveLoader color={COLORS.primary} dotSize={6} />
        )}
      </View>
    );
  }

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

                <View style={styles.actionsWrap}>
                  <TouchableOpacity
                    style={[styles.actionBtn, isDone && styles.actionBtnDone]}
                    onPress={() => openYouTubeSearch(t.title)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Search YouTube for ${t.title}`}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Feather
                      name="youtube"
                      size={18}
                      color="#e02424"
                    />
                  </TouchableOpacity>

                  {(t.hasNotes || __DEV__) && (
                    <TouchableOpacity
                      style={[styles.actionBtn, isDone && styles.actionBtnDone]}
                      onPress={() => openTopicNotes(m, t)}
                      activeOpacity={0.7}
                      accessibilityLabel={`Open notes for ${t.title}`}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Feather
                        name="file-text"
                        size={17}
                        color={t.hasNotes ? COLORS.primary : COLORS.textSubtle}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
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
              <Text style={styles.progressPercentText}>
                {completedTopics} / {totalTopics} Topics ({progressPercent}%)
              </Text>
            </View>
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
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 14,
    marginBottom: 12,
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
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1.2,
  },
  progressPercentText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
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
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressFillDone: {
    backgroundColor: COLORS.secondary,
  },
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
  topicText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: COLORS.text },
  topicTextDone: { color: COLORS.textSubtle },
  bar: { height: 4, borderRadius: 2, backgroundColor: COLORS.borderLight, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.secondary },
});
