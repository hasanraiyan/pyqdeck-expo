import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { COLORS } from '../theme/colors';
import { Topic } from '../types/syllabus';
import { getTopicNotes } from '../api';
import { cleanMarkdown } from '../utils/responsive';
import { solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { ScreenEmpty } from '../components/ScreenState';

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
 */
export const TopicNotesScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { topic, subjectId } = (route.params ?? {}) as {
    topic: Topic;
    subjectId?: string;
  };

  const [notes, setNotes] = useState<string | undefined>(topic?.notes);
  const [loading, setLoading] = useState(Boolean(subjectId && topic?.id));
  const [error, setError] = useState<string | null>(null);

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
});
