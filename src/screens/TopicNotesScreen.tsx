import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONTS } from '../theme/colors';
import { Topic } from '../types/syllabus';
import { getTopicNotes } from '../api';
import { cleanMarkdown } from '../utils/responsive';
import { solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { ScreenEmpty } from '../components/ScreenState';

/**
 * Per-topic study notes: the markdown+LaTeX writeup an admin can attach to a
 * syllabus topic. Opened from the notes icon on SubjectSyllabusScreen, which
 * replaced the inline Ask AI button there - Ask AI still lives here, as a
 * fallback for topics without notes yet, or a second opinion for topics that
 * have them.
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
  const { topic, subjectId, subjectName, semester } = (route.params ?? {}) as {
    topic: Topic;
    subjectId?: string;
    subjectName?: string;
    semester?: number;
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

  const askAi = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const prompt = `Explain "${topic?.title ?? ''}" from the ${subjectName ?? ''} syllabus for a B.Tech semester ${semester ?? ''} exam, with the key points an examiner looks for.`;
    const url = `https://hasanraiyan.me/coursify?search_ai=${encodeURIComponent(prompt)}&send=true`;
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: COLORS.card,
        controlsColor: COLORS.primary,
        secondaryToolbarColor: COLORS.background,
        showTitle: true,
        enableBarCollapsing: true,
      });
    } catch {
      Linking.openURL(url).catch(() => {});
    }
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
        <View style={styles.head}>
          {subjectName ? <Text style={styles.subjectText}>{subjectName}</Text> : null}
          <Text style={styles.title}>{topic.title}</Text>
          <TouchableOpacity style={styles.askBtn} onPress={askAi} activeOpacity={0.7}>
            <Feather name="message-circle" size={13} color={COLORS.primary} />
            <Text style={styles.askBtnText}>Ask AI about this</Text>
          </TouchableOpacity>
        </View>

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
  head: {
    paddingBottom: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
  },
  subjectText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  askBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  askBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.primary,
  },
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
