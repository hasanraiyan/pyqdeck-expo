import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';
import { MarksBadge, YearBadge } from './Badge';
import { NativeContentRenderer } from './NativeContentRenderer';
import { rf } from '../utils/responsive';

interface Props {
  /** A question search hit: the question plus its `subject`. null shows the empty state. */
  question: any | null;
  onOpenQuestion: () => void;
  onOpenSubject: () => void;
}

/**
 * Right pane of the two-pane Search (FR-L5): the full text of the selected
 * question hit, so a student can scan results without a screen change per
 * question. Opening the full question (solution, similar, prev / next) is one
 * tap away. Only questions get a preview; subjects and notes still navigate.
 */
export function QuestionPreviewPane({ question, onOpenQuestion, onOpenSubject }: Props) {
  if (!question) {
    return (
      <View style={styles.empty}>
        <Feather name="help-circle" size={26} color={COLORS.textSubtle} />
        <Text style={styles.emptyTitle}>Select a question to preview it here</Text>
        <Text style={styles.emptyHint}>Subjects and study notes open on their own page.</Text>
      </View>
    );
  }
  return (
    <ScrollView style={styles.pane} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.subject}>{question.subject?.name}</Text>
        <View style={styles.badges}>
          {question.year ? <YearBadge year={question.year} /> : null}
          <MarksBadge marks={question.marks} />
          {question.chapter ? (
            <View style={styles.chapterPill}>
              <Text style={styles.chapterText}>{question.chapter}</Text>
            </View>
          ) : null}
        </View>
        <NativeContentRenderer
          content={question.text || question.textPreview}
          html={question.textHtml}
          fontSize={16}
          variant="question"
        />
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primary} activeOpacity={0.8} onPress={onOpenQuestion}>
          <Text style={styles.primaryText}>Open full question</Text>
          <Feather name="arrow-right" size={15} color="#fff" />
        </TouchableOpacity>
        {question.subject?.id ? (
          <TouchableOpacity style={styles.secondary} activeOpacity={0.7} onPress={onOpenSubject}>
            <Text style={styles.secondaryText}>Open subject</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1, minWidth: 0 },
  content: { padding: 24, width: '100%', maxWidth: 760, alignSelf: 'center' },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 18,
  },
  subject: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    color: COLORS.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chapterPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chapterText: { fontSize: rf(11), color: COLORS.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  primaryText: { color: '#fff', fontSize: rf(13), fontWeight: '600' },
  secondary: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  secondaryText: { color: COLORS.text, fontSize: rf(13) },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyTitle: { fontSize: rf(14), color: COLORS.textMuted, textAlign: 'center' },
  emptyHint: { fontSize: rf(12), color: COLORS.textSubtle, textAlign: 'center' },
});
