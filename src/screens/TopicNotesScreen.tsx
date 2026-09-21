import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONTS } from '../theme/colors';
import { Topic } from '../types/syllabus';
import { getTopicNotes } from '../api';
import { getDoneTopics, saveDoneTopics } from '../db/syllabusProgress';
import { cleanMarkdown } from '../utils/responsive';
import { solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { ScreenEmpty } from '../components/ScreenState';
import { AdBanner } from '../components/AdBanner';
import { PrevNextNav } from '../components/PrevNextNav';
import { WaveLoader } from '../components/WaveLoader';

/** Same namespacing as SubjectSyllabusScreen's topicKey - must stay identical, the two screens read/write the same AsyncStorage key. */
const topicKey = (moduleId: string, topicId: string) => `${moduleId}:${topicId}`;

type NotesListEntry = { id: string; title: string; moduleId: string; moduleName: string };

/**
 * Per-topic study notes: the markdown+LaTeX writeup an admin can attach to a
 * syllabus topic. Opened from the notes icon on SubjectSyllabusScreen, which
 * only shows for a topic that actually has notes (topic.hasNotes), so this
 * screen never needs an Ask AI fallback for an empty topic.
 *
 * Notes are fetched here rather than carried in via route params: they are
 * excluded from the subject payload (see api/index.ts's getTopicNotes) so
 * that opening a subject never pulls every topic's markdown with it, and
 * fetched live, uncached, every time this screen opens, so an admin's edit
 * shows up immediately rather than behind the syllabus's day-long cache.
 *
 * The mark-complete button writes to the same device-local "done" storage
 * SubjectSyllabusScreen's tick uses - reading the notes is as much a sign of
 * having covered a topic as ticking it there, so this is just a second place
 * to flip the same bit.
 *
 * Prev/Next steps through every topic that has notes in the subject (the
 * flattened `notesList` SubjectSyllabusScreen builds), the same way
 * QuestionDetailScreen steps through a paper: via setParams rather than a
 * fresh push, so this screen instance (and its AdBanner) stays mounted
 * instead of a fresh ad load firing on every tap.
 */
export const TopicNotesScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { topic, subjectId, moduleId, notesList, subjectName } = (route.params ?? {}) as {
    topic: Topic;
    subjectId?: string;
    moduleId?: string;
    subjectName?: string;
    notesList?: NotesListEntry[];
  };
  const scrollRef = useRef<ScrollView>(null);

  const [notes, setNotes] = useState<string | undefined>(topic?.notes);
  const [loading, setLoading] = useState(Boolean(subjectId && topic?.id));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const openYouTubeSearch = () => {
    if (!topic?.title) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const query = subjectName ? `${topic.title} ${subjectName} lecture` : `${topic.title} lecture`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query + ' site:youtube.com')}&tbm=vid`;
    WebBrowser.openBrowserAsync(url, {
      toolbarColor: COLORS.card,
      controlsColor: COLORS.primary,
      secondaryToolbarColor: COLORS.background,
      showTitle: true,
      enableBarCollapsing: true,
    }).catch(() => {
      Linking.openURL(url).catch((err) => console.warn('Could not open video search:', err));
    });
  };

  useEffect(() => {
    if (!topic?.title) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={openYouTubeSearch}
          activeOpacity={0.7}
          style={{ padding: 8, marginRight: -4 }}
          accessibilityLabel={`Search YouTube for ${topic.title}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="youtube" size={20} color="#e02424" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, topic?.title, subjectName]);

  useEffect(() => {
    if (!subjectId || !topic?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTopicNotes(subjectId, topic.id)
      .then((res) => {
        if (cancelled) return;
        setNotes(res.notes || undefined);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || 'Could not load notes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId, topic?.id]);

  useEffect(() => {
    if (!subjectId || !moduleId || !topic?.id) return;
    let cancelled = false;
    getDoneTopics(subjectId).then((doneSet) => {
      if (!cancelled) setDone(doneSet.has(topicKey(moduleId, topic.id)));
    });
    return () => {
      cancelled = true;
    };
  }, [subjectId, moduleId, topic?.id]);

  const layoutHeightRef = useRef(0);
  const contentHeightRef = useRef(0);

  const markAsDone = useCallback(async () => {
    if (done || !subjectId || !moduleId || !topic?.id) return;
    const key = topicKey(moduleId, topic.id);
    setDone(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    const doneSet = await getDoneTopics(subjectId);
    if (!doneSet.has(key)) {
      doneSet.add(key);
      await saveDoneTopics(subjectId, doneSet);
    }
  }, [done, subjectId, moduleId, topic?.id]);

  const handleScroll = (e: any) => {
    if (done) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 40;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      void markAsDone();
    }
  };

  useEffect(() => {
    if (done || loading || !notes) return;
    const timer = setTimeout(() => {
      if (
        layoutHeightRef.current > 0 &&
        contentHeightRef.current > 0 &&
        contentHeightRef.current <= layoutHeightRef.current + 40
      ) {
        void markAsDone();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [done, loading, notes, markAsDone]);

  const currentIndex = notesList?.findIndex((t) => t.id === topic?.id) ?? -1;
  const prevEntry = notesList && currentIndex > 0 ? notesList[currentIndex - 1] : null;
  const nextEntry =
    notesList && currentIndex >= 0 && currentIndex < notesList.length - 1
      ? notesList[currentIndex + 1]
      : null;

  const goToTopic = (entry: NotesListEntry) => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    navigation.setParams({
      topic: { id: entry.id, title: entry.title },
      moduleId: entry.moduleId,
      moduleName: entry.moduleName,
    });
  };

  if (!topic) {
    return (
      <View style={styles.centerContainer}>
        <ScreenEmpty message="No topic selected." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Wave Loader positioned just below the navigation header */}
      {loading && (
        <View style={styles.topLoaderBar}>
          <WaveLoader color={COLORS.primary} />
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={(_w, h) => {
          contentHeightRef.current = h;
        }}
        onLayout={(e) => {
          layoutHeightRef.current = e.nativeEvent.layout.height;
        }}
      >
        {loading ? null : notes ? (
          <View style={styles.notesBody}>
            <Markdown style={solutionMarkdownStyles} rules={markdownRules}>
              {cleanMarkdown(notes)}
            </Markdown>
          </View>
        ) : (
          <View style={styles.empty}>
            <Feather name="file-text" size={22} color={COLORS.textSubtle} />
            <Text style={styles.emptyText}>
              {error || 'No notes have been written for this topic yet.'}
            </Text>
          </View>
        )}


        {!loading && (prevEntry || nextEntry) && (
          <View style={styles.navSection}>
            <PrevNextNav
              prev={
                prevEntry
                  ? { label: prevEntry.title, sublabel: 'Previous topic', onPress: () => goToTopic(prevEntry) }
                  : null
              }
              next={
                nextEntry
                  ? { label: nextEntry.title, sublabel: 'Next topic', onPress: () => goToTopic(nextEntry) }
                  : null
              }
            />
          </View>
        )}
      </ScrollView>

      <AdBanner />
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
  scroll: { padding: 16 },
  notesBody: { paddingBottom: 8 },
  navSection: { marginTop: 18 },
  topLoaderBar: {
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSubtle,
    textAlign: 'center',
    maxWidth: 260,
  },
});
