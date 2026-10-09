import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  LayoutChangeEvent,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useSubjectMeta } from '../api/queries';
import { SubjectMeta } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { CircleLoader } from '../components/CircleLoader';
import { Badge } from '../components/Badge';
import { AdBanner } from '../components/AdBanner';
import { useResponsive } from '../utils/responsive';
import { ScreenContainer } from '../components/ScreenContainer';
import { ResponsiveGrid } from '../components/ResponsiveGrid';
import { recordRecentStudy } from '../utils/recentStudy';

export const SubjectDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { width, bp, wideMaxWidth, hPadding } = useResponsive();
  const { semesterId, subjectId, subjectName, subjectCode } = route.params || {};

  const metaQ = useSubjectMeta(subjectId);
  const meta: SubjectMeta | null = metaQ.data ?? null;
  const loading = metaQ.isPending;
  const [refreshing, setRefreshing] = useState(false);

  // Both grids size off the measured wrapper, never off the window: on web
  // useWindowDimensions() includes the ScrollView's scrollbar, and cards sized
  // from it overflow their row and drop one onto the next line.
  const [wrapperWidth, setWrapperWidth] = useState(0);
  const onWrapperLayout = useCallback(
    (e: LayoutChangeEvent) => setWrapperWidth(e.nativeEvent.layout.width),
    []
  );
  const track = wrapperWidth || Math.min(width - hPadding * 2, wideMaxWidth);

  // A subject can have any number of papers, so the year grid picks columns
  // from how many ~190px cards fit, capped to the number of years (3 papers
  // fill the row) and never fewer than 2.
  const YEAR_GAP = 12;
  const yearCount = meta?.years?.length || 4;
  const yearMaxColumns = Math.max(2, Math.min(4, yearCount));
  const yearAllowedColumns = [2, 3, 4].filter((c) => c <= yearMaxColumns);

  // Module rows are text-heavy (name + count + chevron), so they get two
  // columns at most - three would clip the longer chapter names.
  const MODULE_GAP = 8;
  const moduleColumns = bp({ phone: 1, tablet: 2 });
  const moduleCardWidth =
    moduleColumns > 1
      ? (track - MODULE_GAP * (moduleColumns - 1)) / moduleColumns
      : undefined;

  useEffect(() => {
    if (!meta) return;
    void recordRecentStudy({
      subjectId,
      subjectName: meta.name || subjectName,
      semesterId,
      subjectCode: meta.code || subjectCode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.id, subjectId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await metaQ.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <ScreenContainer variant="wide">
        <View onLayout={onWrapperLayout}>
          {/* Subject Header */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              {subjectCode ? <Badge label={subjectCode} variant="secondary" /> : null}
              <Text style={styles.semLabel}>
                {semesterId ? `SEMESTER ${semesterId.replace(/\D/g, '')}` : 'SUBJECT'}
              </Text>
            </View>
            <Text style={styles.title}>{meta?.name || subjectName}</Text>
            <Text style={styles.subtitle}>
              {meta?.years?.reduce((n, y) => n + y.questionCount, 0) ?? '—'} questions available across{' '}
              {meta?.years?.length ?? '—'} exam papers.
            </Text>
          </View>

          {/* Papers by Year */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>QUESTION PAPERS BY YEAR</Text>
            {loading ? (
              <View style={styles.loaderBox}>
                <CircleLoader color={COLORS.primary} dotSize={6} size={40} />
              </View>
            ) : meta?.years && meta.years.length > 0 ? (
              <ResponsiveGrid
                data={meta.years}
                keyExtractor={(y) => String(y.year)}
                minCardWidth={178}
                gap={YEAR_GAP}
                maxColumns={yearMaxColumns}
                allowedColumns={yearAllowedColumns}
                estimatedWidth={track}
                renderItem={(y, { cardWidth }) => {
                  const isComingSoon = y.questionCount === 0;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.yearCard,
                        { width: cardWidth },
                        isComingSoon && styles.cardComingSoon,
                      ]}
                      activeOpacity={0.7}
                      onPress={() =>
                        navigation.navigate('QuestionList', {
                          semesterId,
                          subjectId,
                          subjectName: meta?.name || subjectName,
                          subjectCode,
                          initialYear: y.year,
                        })
                      }
                    >
                      <View style={styles.yearCardTop}>
                        <Text style={styles.yearNumber}>{y.year}</Text>
                        {isComingSoon && (
                          <View style={styles.soonTag}>
                            <Text style={styles.soonTagText}>SOON</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.yearSubtext}>
                        {isComingSoon
                          ? 'Coming Soon'
                          : `${y.questionCount} question${y.questionCount === 1 ? '' : 's'}`}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            ) : (
            <View style={styles.sectionEmptyBox}>
              <Feather name="clock" size={14} color={COLORS.primary} />
              <Text style={styles.sectionEmptyText}>Question papers coming soon</Text>
            </View>
          )}
        </View>

        {/* Modules / Chapters Section */}
        {!loading && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>PRACTICE BY MODULE</Text>
            {meta?.chapters && meta.chapters.length > 0 ? (
              <View style={[styles.moduleList, moduleColumns > 1 && styles.moduleListGrid]}>
              {meta.chapters.map((ch, idx) => {
                const isComingSoon = ch.questionCount === 0;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.moduleCard,
                      { width: moduleCardWidth },
                      isComingSoon && styles.cardComingSoon,
                    ]}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate('QuestionList', {
                        semesterId,
                        subjectId,
                        subjectName: meta?.name || subjectName,
                        subjectCode,
                        initialChapter: ch.chapter,
                      })
                    }
                  >
                    <View style={styles.moduleLeft}>
                      <Text style={styles.moduleName}>{ch.chapter}</Text>
                      <Text style={styles.moduleCount}>
                        {isComingSoon
                          ? 'Coming Soon'
                          : `${ch.questionCount} question${ch.questionCount === 1 ? '' : 's'}`}
                      </Text>
                    </View>
                    {isComingSoon ? (
                      <View style={styles.soonTag}>
                        <Text style={styles.soonTagText}>SOON</Text>
                      </View>
                    ) : (
                      <Feather name="arrow-right" size={15} color={COLORS.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.sectionEmptyBox}>
              <Feather name="clock" size={14} color={COLORS.primary} />
              <Text style={styles.sectionEmptyText}>Module breakdown coming soon</Text>
            </View>
          )}
        </View>
        )}
      </View>
        </ScreenContainer>
      </ScrollView>
      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingVertical: 18,
    paddingBottom: 40,
  },
  header: {
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  semLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textSubtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 25,
    color: COLORS.text,
    lineHeight: 31,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13.5,
    color: COLORS.textMuted,
    marginTop: 6,
    lineHeight: 19,
  },
  section: {
    marginTop: 22,
  },
  sectionHeading: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    color: COLORS.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Cards carry measured widths and the container supplies the gap, so a
    // partly-filled last row must stay left-aligned rather than stretch.
    justifyContent: 'flex-start',
  },
  yearCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  cardComingSoon: {
    backgroundColor: COLORS.cardSecondary,
    borderStyle: 'dashed',
  },
  yearCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  soonTag: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  soonTagText: {
    fontFamily: FONTS.displayBold,
    fontSize: 8.5,
    color: COLORS.textSubtle,
  },
  sectionEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderStyle: 'dashed',
    borderRadius: 4,
    padding: 14,
  },
  sectionEmptyText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  loaderBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearNumber: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.text,
  },
  yearSubtext: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10.5,
    color: COLORS.textMuted,
  },
  moduleList: {
    gap: 8,
  },
  moduleListGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  moduleLeft: {
    flex: 1,
    paddingRight: 10,
  },
  moduleName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  moduleCount: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});

