import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { BRANCHES, availableSemesters, getSemester } from '../data/syllabus';
import { topicCountOf } from '../types/syllabus';
import { getDoneCounts } from '../db/syllabusProgress';

/**
 * Semesters for the chosen branch - only the ones that actually have a syllabus
 * behind them. Semesters without one are left off entirely rather than shown as
 * placeholders: a grid of "not added yet" cards makes a working screen look
 * broken, and there is nothing a student can do with a semester that isn't
 * there.
 */
export const SemesterSelectScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const branchId: string = route.params?.branchId ?? 'cse';
  const branch = BRANCHES.find((b) => b.id === branchId);

  const [progress, setProgress] = useState<Record<number, { done: number; total: number }>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const next: Record<number, { done: number; total: number }> = {};
        for (const n of availableSemesters(branchId)) {
          const sem = getSemester(branchId, n);
          if (!sem) continue;
          const counts = await getDoneCounts(sem.subjects.map((s) => s.id));
          next[n] = {
            done: sem.subjects.reduce((acc, s) => acc + (counts[s.id] ?? 0), 0),
            total: sem.subjects.reduce((acc, s) => acc + topicCountOf(s), 0),
          };
        }
        if (alive) setProgress(next);
      })();
      return () => {
        alive = false;
      };
    }, [branchId])
  );

  const open = (n: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SyllabusOverview', { branchId, semester: n });
  };

  const live = availableSemesters(branchId).sort((a, b) => a - b);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <View style={styles.head}>
          <Text style={styles.kicker}>{branch?.code ?? branchId.toUpperCase()}</Text>
          <Text style={styles.title}>{branch?.name ?? 'Semesters'}</Text>
          <Text style={styles.sub}>
            {live.length > 0
              ? 'Modules, topics and your progress for each semester.'
              : 'No syllabus has been typed up for this branch yet.'}
          </Text>
        </View>

        {live.length > 0 && (
          <View style={styles.grid}>
            {live.map((n) => {
              const sem = getSemester(branchId, n)!;
              const p = progress[n];
              const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              const complete = p && p.total > 0 && p.done === p.total;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.card, complete && styles.cardDone]}
                  activeOpacity={0.7}
                  onPress={() => open(n)}
                >
                  <Text style={styles.cardLabel}>Semester</Text>
                  <Text style={styles.cardNum}>{n}</Text>
                  <Text style={styles.cardMeta}>
                    {sem.subjects.length} subjects · {p ? p.total : '—'} topics
                  </Text>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={p && p.done > 0 ? styles.cardProg : styles.cardMeta}>
                    {p ? (p.done > 0 ? `${p.done} of ${p.total} done` : 'Not started') : ' '}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  head: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 25,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 31,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  sub: { fontSize: 13, color: COLORS.textMuted, marginTop: 6, lineHeight: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  card: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 112,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 3,
  },
  cardDone: { borderColor: COLORS.secondary },
  cardLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  cardNum: { fontFamily: FONTS.serif, fontSize: 30, color: COLORS.text, lineHeight: 35 },
  cardMeta: { fontFamily: FONTS.mono, fontSize: 10.5, color: COLORS.textSubtle },
  cardProg: { fontFamily: FONTS.mono, fontSize: 10.5, color: COLORS.secondary },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
    overflow: 'hidden',
    marginTop: 5,
    marginBottom: 2,
  },
  barFill: { height: '100%', backgroundColor: COLORS.secondary },
});
