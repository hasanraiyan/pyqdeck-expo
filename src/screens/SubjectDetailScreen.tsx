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
import { getSubjectMeta } from '../api';
import { SubjectMeta } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { Skeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';
import { AdBanner } from '../components/AdBanner';
import { useResponsive } from '../utils/responsive';

export const SubjectDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { width, bp, wideMaxWidth, hPadding } = useResponsive();
  const { semesterId, subjectId, subjectName, subjectCode } = route.params || {};

  const [meta, setMeta] = useState<SubjectMeta | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Unlike Home's fixed 4 years, a subject can have any number of papers, so
  // the column count comes from how many ~190px cards fit - then capped to
  // the number of years, so 3 papers fill the row instead of leaving a
  // quarter of it blank.
  const YEAR_GAP = 12;
  const yearCount = meta?.years?.length || 4;
  const yearColumns = Math.max(2, Math.min(Math.floor(track / 190) || 2, 4, yearCount));
  const yearCardWidth = (track - YEAR_GAP * (yearColumns - 1)) / yearColumns;

  // Module rows are text-heavy (name + count + chevron), so they get two
  // columns at most - three would clip the longer chapter names.
  const MODULE_GAP = 8;
  const moduleColumns = bp({ phone: 1, tablet: 2 });
  const moduleCardWidth =
    moduleColumns > 1
      ? (track - MODULE_GAP * (moduleColumns - 1)) / moduleColumns
      : undefined;

  const loadData = async (forceRefresh = false) => {
    try {
      const data = await getSubjectMeta(subjectId, forceRefresh);
      setMeta(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subjectId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24, paddingHorizontal: hPadding }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View
          style={{ maxWidth: wideMaxWidth, width: '100%', alignSelf: 'center' }}
          onLayout={onWrapperLayout}
        >
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
              <View style={[styles.grid, { gap: YEAR_GAP }]}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={[styles.yearCardSkeleton, { width: yearCardWidth }]}>
                    <Skeleton width={60} height={24} style={{ marginBottom: 6 }} />
                    <Skeleton width={40} height={12} />
                  </View>
                ))}
              </View>
            ) : meta?.years && meta.years.length > 0 ? (
              <View style={[styles.grid, { gap: YEAR_GAP }]}>
                {meta.years.map((y) => {
                  const isComingSoon = y.questionCount === 0;
                  return (
                    <TouchableOpacity
                      key={y.year}
                      style={[
                        styles.yearCard,
                        { width: yearCardWidth },
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
                })}
              </View>
            ) : (
            <View style={styles.sectionEmptyBox}>
              <Feather name="clock" size={14} color={COLORS.primary} />
              <Text style={styles.sectionEmptyText}>Question papers coming soon</Text>
            </View>
          )}
        </View>

        {/* Modules / Chapters Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>PRACTICE BY MODULE</Text>
          {loading ? (
            <View style={[styles.moduleList, moduleColumns > 1 && styles.moduleListGrid]}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[styles.moduleCardSkeleton, { width: moduleCardWidth }]}
                >
                  <Skeleton width="60%" height={16} style={{ marginBottom: 6 }} />
                  <Skeleton width="30%" height={12} />
                </View>
              ))}
            </View>
          ) : meta?.chapters && meta.chapters.length > 0 ? (
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
        </View>
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
    paddingHorizontal: 16,
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
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textSubtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 25,
    fontStyle: 'italic',
    fontWeight: '400',
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
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
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
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    fontWeight: '700',
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
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  yearCardSkeleton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  yearNumber: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    fontStyle: 'italic',
    fontWeight: '500',
    color: COLORS.text,
  },
  yearSubtext: {
    fontFamily: FONTS.mono,
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
  moduleCardSkeleton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 14,
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
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});

