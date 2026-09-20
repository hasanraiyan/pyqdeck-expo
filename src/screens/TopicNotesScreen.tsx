import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
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

  const toggleDone = async () => {
    if (!subjectId || !moduleId || !topic?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const key = topicKey(moduleId, topic.id);
    const next = !done;
    setDone(next);
    const doneSet = await getDoneTopics(subjectId);
    if (next) doneSet.add(key);
    else doneSet.delete(key);
    await saveDoneTopics(subjectId, doneSet);
  };

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
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : notes ? (
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

        {!loading && subjectId && moduleId && (
          <TouchableOpacity
            style={[styles.completeBtn, done && styles.completeBtnDone]}
            onPress={toggleDone}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
          >
            <Feather
              name={done ? 'check-circle' : 'circle'}
              size={17}
              color={done ? COLORS.card : COLORS.primary}
            />
            <Text style={[styles.completeBtnText, done && styles.completeBtnTextDone]}>
              {done ? 'Marked as complete' : 'Mark as complete'}
            </Text>
          </TouchableOpacity>
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
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 80,
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
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 13,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  completeBtnDone: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  completeBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  completeBtnTextDone: {
    color: COLORS.card,
  },
});
