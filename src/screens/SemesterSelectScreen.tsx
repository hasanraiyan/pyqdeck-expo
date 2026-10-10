import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { useQueryClient } from '@tanstack/react-query';
import { useSyllabusBranches, useSyllabusSemesters, syllabusSemesterQuery } from '../api/queries';
import { Branch, BranchSemesters } from '../types/syllabus';
import { getDoneCounts, subscribeProgress } from '../db/syllabusProgress';
import { requestSyncOnStudyOpen } from '../db/progressSync';
import { getSelectedBranch, setSelectedBranch } from '../utils/settings';
import { ScreenError, ScreenEmpty } from '../components/ScreenState';
import { CircleLoader } from '../components/CircleLoader';
import { userMessage } from '../utils/netError';
import { useContainerStyle } from '../components/ScreenContainer';

export const SemesterSelectScreen = () => {
  const frame = useContainerStyle('read', false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // `branchId` is the in-app param; `branch` is the web query key from a
  // shared `pyqdeck.in/syllabus?branch=` deep link (see App.tsx linking).
  const paramBranch = route.params?.branchId ?? route.params?.branch ?? '';

  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(paramBranch);
  const [isBranchReady, setIsBranchReady] = useState<boolean>(!!paramBranch);
  const branchesQ = useSyllabusBranches();
  const semestersQ = useSyllabusSemesters(selectedBranchId, {
    enabled: isBranchReady && !!selectedBranchId,
  });
  const branches: Branch[] | null = branchesQ.data ?? null;
  const data: BranchSemesters | null = semestersQ.data ?? null;
  // Only an error when there is nothing (not even a persisted copy) to show.
  const error =
    semestersQ.isError && !semestersQ.data
      ? userMessage(semestersQ.error, 'Could not load semesters for this branch.')
      : null;
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<Record<number, { done: number; total: number }>>({});

  // 1. Restore saved branch from storage on mount (if not in route params)
  useEffect(() => {
    if (paramBranch) {
      setSelectedBranchId(paramBranch);
      setIsBranchReady(true);
      return;
    }
    let alive = true;
    getSelectedBranch().then((saved) => {
      if (alive) {
        setSelectedBranchId(saved || 'cse');
        setIsBranchReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [paramBranch]);

  // Prefetch the semester sheets for instant navigation
  useEffect(() => {
    if (!data) return;
    for (const s of data.semesters) {
      void queryClient.prefetchQuery({
        ...syllabusSemesterQuery(selectedBranchId, s.semester),
        staleTime: 60_000,
      });
    }
  }, [data, selectedBranchId, queryClient]);

  // Track progress counts across subjects
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!data) return;
      const load = () =>
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
      void load();
      // Opening the Study tab is one of the sync triggers (at most once a minute).
      requestSyncOnStudyOpen();
      const unsubscribe = subscribeProgress(() => void load());
      return () => {
        alive = false;
        unsubscribe();
      };
    }, [data])
  );

  const { width: windowWidth } = useWindowDimensions();
  const branchScrollRef = useRef<ScrollView>(null);
  const chipLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const scrollWidthRef = useRef<number>(0);

  const scrollToBranch = useCallback(
    (branchId: string, animated = true) => {
      const layout = chipLayoutsRef.current[branchId];
      const containerWidth = scrollWidthRef.current || windowWidth;
      if (!layout || !containerWidth) return;

      const targetX = layout.x + layout.width / 2 - containerWidth / 2;
      branchScrollRef.current?.scrollTo({
        x: Math.max(0, targetX),
        animated,
      });
    },
    [windowWidth]
  );

  // Auto-center the selected branch when branch selection changes
  useEffect(() => {
    if (selectedBranchId && chipLayoutsRef.current[selectedBranchId]) {
      scrollToBranch(selectedBranchId, true);
    }
  }, [selectedBranchId, scrollToBranch]);

  // Center selected branch when returning back to the screen
  useFocusEffect(
    useCallback(() => {
      if (selectedBranchId) {
        const timer = setTimeout(() => {
          scrollToBranch(selectedBranchId, true);
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [selectedBranchId, scrollToBranch])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([branchesQ.refetch(), semestersQ.refetch()]);
    setRefreshing(false);
  };

  const handleSelectBranch = async (branchId: string) => {
    if (branchId === selectedBranchId) return;
    Haptics.selectionAsync();
    setSelectedBranchId(branchId);
    scrollToBranch(branchId, true);
    await setSelectedBranch(branchId);
  };

  const openSemester = (n: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SyllabusOverview', {
      branchId: selectedBranchId,
      semester: n,
    });
  };

  const activeBranch = branches?.find((b) => b.id === selectedBranchId) || data?.branch;
  const live = data?.semesters ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[frame, { paddingBottom: insets.bottom + 28 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Main Header */}
        <View style={styles.head}>
          <Text style={styles.kicker}>PyQdeck · Syllabus</Text>
          <Text style={styles.title}>Curriculum & Tracking</Text>
          <Text style={styles.sub}>
            Select your branch and track completed topics, syllabus notes & exam structure.
          </Text>
        </View>

        {/* Horizontal Branch Selector Chips */}
        {branches && branches.length > 0 && (
          <View style={styles.branchSection}>
            <ScrollView
              ref={branchScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.branchChipsScroll}
              onLayout={(e) => {
                scrollWidthRef.current = e.nativeEvent.layout.width;
                if (selectedBranchId) {
                  scrollToBranch(selectedBranchId, false);
                }
              }}
            >
              {branches.map((b) => {
                const active = b.id === selectedBranchId;
                return (
                  <TouchableOpacity
                    key={b.id}
                    onLayout={(e) => {
                      const { x, width } = e.nativeEvent.layout;
                      chipLayoutsRef.current[b.id] = { x, width };
                      if (b.id === selectedBranchId) {
                        scrollToBranch(b.id, false);
                      }
                    }}
                    style={[styles.branchChip, active && styles.branchChipActive]}
                    onPress={() => handleSelectBranch(b.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.branchChipText, active && styles.branchChipTextActive]}
                    >
                      {b.code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Selected Branch Info Bar */}
        {activeBranch && (
          <View style={styles.branchInfoCard}>
            <View style={styles.branchInfoRow}>
              <View style={styles.branchIconBox}>
                <Feather name="book-open" size={16} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.branchFullName} numberOfLines={1}>
                  {activeBranch.name}
                </Text>
                <Text style={styles.branchMetaText}>
                  {live.length > 0
                    ? `${live.length} Semesters ready · ${activeBranch.subjectCount ?? 0} Subjects`
                    : 'Syllabus being typed up'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Loading / Error / Empty States */}
        {!data && !error && (
          <View style={styles.loaderContainer}>
            <CircleLoader color={COLORS.primary} dotSize={6} size={40} />
          </View>
        )}

        {error && (
          <ScreenError message={error} onRetry={() => void semestersQ.refetch()} />
        )}

        {data && live.length === 0 && (
          <ScreenEmpty message="No syllabus has been uploaded for this branch yet." />
        )}

        {/* Semesters Grid */}
        {data && live.length > 0 && (
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
                  onPress={() => openSemester(s.semester)}
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
                    {done > 0 ? `${done} of ${total} done (${pct}%)` : 'Not started'}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  head: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  kicker: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.primary,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.text,
    lineHeight: 32,
    letterSpacing: -0.5,
    marginTop: 6,
  },
  sub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },

  // Branch Chips
  branchSection: {
    marginBottom: 12,
  },
  branchChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  branchChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  branchChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  branchChipText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    color: COLORS.text,
  },
  branchChipTextActive: {
    color: '#FFFFFF',
  },

  // Branch Info Banner
  branchInfoCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  branchInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  branchIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  branchFullName: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    color: COLORS.text,
  },
  branchMetaText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Semesters Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
  card: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 116,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 3,
  },
  cardDone: {
    borderColor: COLORS.secondary,
  },
  cardLabel: {
    fontFamily: FONTS.displayBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  cardNum: {
    fontFamily: FONTS.display,
    fontSize: 30,
    color: COLORS.text,
    lineHeight: 35,
  },
  cardMeta: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10.5,
    color: COLORS.textSubtle,
  },
  cardProg: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10.5,
    color: COLORS.secondary,
  },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
    overflow: 'hidden',
    marginTop: 5,
    marginBottom: 2,
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
  },
  loaderContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
