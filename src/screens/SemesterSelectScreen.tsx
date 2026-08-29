import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { getBranchSemesters, getBranchSemester } from '../api';
import { BranchSemesters } from '../types/syllabus';
import { getDoneCounts } from '../db/syllabusProgress';
import { ScreenError, ScreenEmpty } from '../components/ScreenState';
import { SemesterGridSkeleton } from '../components/Skeletons';

/**
 * Semesters for the chosen branch - only the ones that actually have a syllabus
 * behind them. Semesters without one are left off entirely rather than shown as
 * placeholders: a grid of "not added yet" cards makes a working screen look
 * broken, and there is nothing a student can do with a semester that isn't
 * there.
 *
 * Loads through the syllabus read-through cache, so a repeat visit renders from
 * a day-old snapshot without touching the network, and an offline device still
 * gets its grid.
 */
export const SemesterSelectScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const branchId: string = route.params?.branchId ?? 'cse';

  const [data, setData] = useState<BranchSemesters | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<Record<number, { done: number; total: number }>>({});

  const load = useCallback(
    async (force = false) => {
      try {
        setError(null);
        setData(await getBranchSemesters(branchId, force));
      } catch (e: any) {
        setError(e?.message || 'Could not load semesters.');
      }
    },
    [branchId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Prefetch each semester's subject sheet while the grid is on screen, so the
  // overview opens from cache. Same read-through cache, same server, so this is
  // cheap when warm - it only ever does real work on the first visit.
  useEffect(() => {
    if (!data) return;
    for (const s of data.semesters) {
      void getBranchSemester(branchId, s.semester).catch(() => {});
    }
  }, [data, branchId]);

  // Progress recomputes on focus so a topic you ticked in a subject shows up on
  // the semester card the moment you come back. One multiGet for the whole
  // screen - the API hands back each semester's subject ids with the list.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!data) return;
      getDoneCounts(data.semesters.flatMap((s) => s.subjectIds)).then((counts) => {
        if (!alive) return;
        const next: Record<number, { done: number; total: number }> = {};
        for (const s of data.semesters) {
          next[s.semester] = {
            done: s.subjectIds.reduce((n, id) => n + (counts[id] ?? 0), 0),
            total: s.topicCount,
          };
        }
        setProgress(next);
      });
      return () => {
        alive = false;
      };
    }, [data])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const open = (n: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SyllabusOverview', { branchId, semester: n });
  };

  if (!data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {error ? (
          <ScreenError message={error} onRetry={() => load(true)} />
        ) : (
          <SemesterGridSkeleton />
        )}
      </View>
    );
  }

  const live = data.semesters;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.head}>
          <Text style={styles.kicker}>{data.branch.code}</Text>
          <Text style={styles.title}>{data.branch.name}</Text>
          <Text style={styles.sub}>
            {live.length > 0
              ? 'Modules, topics and your progress for each semester.'
              : 'No syllabus has been typed up for this branch yet.'}
          </Text>
        </View>

        {live.length === 0 ? (
          <ScreenEmpty message="No syllabus has been typed up for this branch yet." />
        ) : (
          <View style={styles.grid}>
            {live.map((s) => {
              const total = progress[s.semester]?.total ?? s.topicCount;
              const done = progress[s.semester]?.done ?? 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const complete = total > 0 && done === total;
              return (
                <TouchableOpacity
                  key={s.semester}
                  style={[styles.card, complete && styles.cardDone]}
                  activeOpacity={0.7}
                  onPress={() => open(s.semester)}
                >
                  <Text style={styles.cardLabel}>Semester</Text>
                  <Text style={styles.cardNum}>{s.semester}</Text>
                  <Text style={styles.cardMeta}>
                    {s.subjectCount} subjects · {total} topics
                  </Text>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={done > 0 ? styles.cardProg : styles.cardMeta}>
                    {done > 0 ? `${done} of ${total} done` : 'Not started'}
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
