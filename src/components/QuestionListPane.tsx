import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { QuestionSummary } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { rf } from '../utils/responsive';

interface Props {
  questions: QuestionSummary[];
  selectedId?: string;
  year?: number | string;
  width: number;
  onSelect: (q: QuestionSummary) => void;
}

/**
 * Left pane of the two-pane question view (FR-L3): the questions of the paper
 * being read, with the open one highlighted (FR-L8). It only lists and
 * selects; the detail screen owns what selecting does, so ads, scroll reset
 * and state resets behave exactly as they do for Prev / Next.
 */
export function QuestionListPane({ questions, selectedId, year, width, onSelect }: Props) {
  return (
    <View style={[styles.pane, { width, minWidth: width, maxWidth: width }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{year ? `Paper ${year}` : 'Questions'}</Text>
        <Text style={styles.headerCount}>{questions.length} questions</Text>
      </View>
      <FlatList
        data={questions}
        keyExtractor={(q) => q.questionId}
        extraData={selectedId}
        renderItem={({ item }) => {
          const selected = item.questionId === selectedId;
          const label = String(item.qNumber).startsWith('Q') ? item.qNumber : `Q${item.qNumber}`;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) {
                  Haptics.selectionAsync();
                  onSelect(item);
                }
              }}
              style={({ pressed, hovered }: any) => [
                styles.row,
                selected && styles.rowSelected,
                !selected && (pressed || hovered) && styles.rowHover,
              ]}
            >
              <View style={styles.rowTop}>
                <Text style={[styles.qNum, selected && styles.qNumSelected]}>{label}</Text>
                <View style={styles.meta}>
                  {item.hasSolution ? (
                    <Feather name="check-circle" size={12} color={COLORS.primary} />
                  ) : null}
                  {item.marks ? <Text style={styles.marks}>{item.marks} marks</Text> : null}
                </View>
              </View>
              <Text style={styles.preview} numberOfLines={2}>
                {item.textPreview || item.text}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    backgroundColor: COLORS.card,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.serif, fontSize: rf(18), color: COLORS.text },
  headerCount: { marginTop: 2, fontSize: rf(11), color: COLORS.textMuted },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  rowSelected: { backgroundColor: COLORS.background, borderLeftColor: COLORS.primary },
  rowHover: { backgroundColor: COLORS.background },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  qNum: { fontSize: rf(12), fontWeight: '700', color: COLORS.textMuted },
  qNumSelected: { color: COLORS.primary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marks: { fontSize: rf(11), color: COLORS.textMuted },
  preview: { fontSize: rf(13), lineHeight: rf(19), color: COLORS.text },
});
