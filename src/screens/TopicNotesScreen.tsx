import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONTS } from '../theme/colors';
import { Topic } from '../types/syllabus';
import { getTopicNotes } from '../api';
import { getDoneTopics, saveDoneTopics } from '../db/syllabusProgress';
import { cleanMarkdown } from '../utils/responsive';
import { solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { ScreenEmpty } from '../components/ScreenState';
import { AdBanner } from '../components/AdBanner';

/** Same namespacing as SubjectSyllabusScreen's topicKey - must stay identical, the two screens read/write the same AsyncStorage key. */
const topicKey = (moduleId: string, topicId: string) => `${moduleId}:${topicId}`;

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
 * The mark-complete button at the bottom writes to the same device-local
 * "done" storage SubjectSyllabusScreen's tick uses - reading the notes is as
 * much a sign of having covered a topic as ticking it there, so this is
 * just a second place to flip the same bit.
 */
export const TopicNotesScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { topic, subjectId, moduleId } = (route.params ?? {}) as {
    topic: Topic;
    subjectId?: string;
    moduleId?: string;
  };

  const [notes, setNotes] = useState<string | undefined>(topic?.notes);
  const [loading, setLoading] = useState(Boolean(subjectId && topic?.id));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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

  if (!topic) {
    return (
      <View style={styles.centerContainer}>
        <ScreenEmpty message="No topic selected." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="small" color={COLORS.primary} />
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
