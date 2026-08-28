import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { getSemesters, getSubjects } from '../api';
import { getCachedSemesters, getCachedSubjects, saveCachedSemesters } from '../db/cacheService';
import { Semester } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { Skeleton } from '../components/Skeleton';
import { rf, scale, verticalScale, useResponsive } from '../utils/responsive';
import { yearNumberOf, YEAR_NUMBERS } from '../utils/year';

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { width, bp, wideMaxWidth, hPadding } = useResponsive();

  // Laptop and up gets a real two-column hero: the pitch on the left, the
  // search box and stats stacked on the right. Below that there isn't enough
  // width for two columns to beat one.
  const heroTwoCol = bp({ phone: false, laptop: true });
  // The CTA's button sits beside its text once there's room for both.
  const ctaRow = bp({ phone: false, tablet: true });

  const GRID_GAP = 12;
  // The grid measures itself rather than deriving its width from the window.
  // useWindowDimensions() reports window.innerWidth on web, which *includes*
  // the vertical scrollbar (~15-20px) that the content box does not get - so
  // window-derived card widths overflow and drop a card onto the next row.
  // onLayout reports the box that actually exists, on native and web alike.
  const [gridWidth, setGridWidth] = useState(0);
  const onGridLayout = useCallback(
    (e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width),
    []
  );
  // Before the first layout pass, estimate so the initial paint is close.
  const trackWidth = gridWidth || Math.min(width - hPadding * 2, wideMaxWidth);
  // There are exactly 4 year cards, so only 2 and 4 tile without leaving an
  // orphan row - hence a width threshold rather than a per-breakpoint count.
  // 640 is where 4-up stops squeezing the cards below ~150px.
  const columns = trackWidth >= 640 ? 4 : 2;
  const cardWidth = (trackWidth - GRID_GAP * (columns - 1)) / columns;

  // Driven by the live hook, not the module-level rf() snapshot, so type
  // actually reflows when a browser window is resized.
  const heroTitleSize = bp({ phone: rf(27), tablet: rf(30), laptop: rf(34), desktop: rf(37) });
  const heroSubtitleSize = bp({ phone: rf(13.5), laptop: rf(15) });
  const [semestersData, setSemestersData] = useState<
    { semester: Semester; subjectCount: number }[]
  >([]);
  const [stats, setStats] = useState({ subjects: 0, questions: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isManualRefresh = false) => {
    // 1. Instant 0ms load from cache if available
    if (!isManualRefresh) {
      const cached = await getCachedSemesters();
      if (cached && cached.length > 0) {
        const cachedWithCounts = await Promise.all(
          cached.map(async (sem) => {
            const subs = (await getCachedSubjects(sem.id)) || [];
            return { semester: sem, subjectCount: subs.length };
          })
        );
        setSemestersData(cachedWithCounts);
        const totalSub = cachedWithCounts.reduce((sum, item) => sum + item.subjectCount, 0);
        setStats((prev) => ({ ...prev, subjects: totalSub }));
        setLoading(false);
      }
    }

    // 2. Fetch fresh data from API
    try {
      const semesters = await getSemesters(isManualRefresh);
      let totalQuestions = 0;
      let totalSubjects = 0;

      const withCounts = await Promise.all(
        semesters.map(async (sem) => {
          try {
            const subs = await getSubjects(sem.id, isManualRefresh);
            totalSubjects += subs.length;
            totalQuestions += subs.reduce((n, s) => n + s.questionCount, 0);
            return { semester: sem, subjectCount: subs.length };
          } catch {
            return { semester: sem, subjectCount: 0 };
          }
        })
      );

      setSemestersData(withCounts);
      setStats({ subjects: totalSubjects, questions: totalQuestions });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const yearsData = useMemo(
    () =>
      YEAR_NUMBERS.map((year) => {
        const semestersInYear = semestersData.filter(
          ({ semester }) => yearNumberOf(semester.number) === year
        );
        return {
          year,
          semesters: semestersInYear.map(({ semester }) => semester),
          subjectCount: semestersInYear.reduce((sum, s) => sum + s.subjectCount, 0),
        };
      }),
    [semestersData]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Site Header bar with Official PyQdeck Logo */}
      <View style={styles.siteHeader}>
        {/* Capped to the same width as the content below, so on a wide screen
            the brand lines up with the hero instead of hugging the viewport. */}
        <View
          style={[
            styles.headerInner,
            { maxWidth: wideMaxWidth, paddingHorizontal: hPadding },
          ]}
        >
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/app-icon.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.brandTitle}>PyQdeck</Text>
              <Text style={styles.brandSubtitle}>BEU PYQ ARCHIVE</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('AllSubjects')}
              style={styles.headerLink}
            >
              <Text style={styles.headerLinkText}>Subjects</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={styles.headerIconButton}
              hitSlop={8}
            >
              <Feather name="settings" size={19} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 24, paddingHorizontal: hPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={[styles.centerWrapper, { maxWidth: wideMaxWidth }]}>
          {/* Hero Section */}
          <View style={[styles.hero, heroTwoCol && styles.heroRow]}>
            <View style={heroTwoCol ? styles.heroCopyCol : undefined}>
              <Text style={[styles.heroTitle, { fontSize: heroTitleSize, lineHeight: heroTitleSize * 1.26 }]}>
                {/* The forced break shapes the phone layout; on wider screens
                    it would leave a short, ragged first line. */}
                {heroTwoCol
                  ? 'BEU Previous Year Question Papers'
                  : 'BEU Previous Year\nQuestion Papers'}
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  { fontSize: heroSubtitleSize, lineHeight: heroSubtitleSize * 1.5 },
                ]}
              >
                Previous-year exam question papers for Bihar Engineering University (BEU)
                B.Tech students, sorted by semester, subject, and year.
              </Text>
            </View>

            <View style={heroTwoCol ? styles.heroAsideCol : undefined}>
              {/* Quick Search Bar Shortcut */}
              <TouchableOpacity
                style={styles.heroSearchBox}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('Search')}
              >
                <Feather name="search" size={16} color={COLORS.textMuted} />
                <Text style={styles.heroSearchPlaceholder}>Search subjects, questions, theorems...</Text>
              </TouchableOpacity>

              {/* Stats Bar */}
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.subjects || '—'}</Text> SUBJECTS
                  </Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.questions || '—'}</Text> QUESTIONS
                  </Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statItem}>
                    <Text style={styles.statNumber}>4</Text> YEARS
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Year Selection Section */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>SELECT YEAR</Text>

            {loading ? (
              <View style={[styles.grid, { gap: GRID_GAP }]} onLayout={onGridLayout}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[styles.gridCardSkeleton, { width: cardWidth }]}
                  >
                    <Skeleton width={50} height={10} style={{ marginBottom: 6 }} />
                    <Skeleton width={40} height={28} style={{ marginBottom: 6 }} />
                    <Skeleton width={60} height={10} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.grid, { gap: GRID_GAP }]} onLayout={onGridLayout}>
                {yearsData.map(({ year, semesters, subjectCount }) => {
                  const isComingSoon = subjectCount === 0;
                  return (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.gridCard,
                        { width: cardWidth },
                        isComingSoon && styles.gridCardComingSoon,
                      ]}
                      activeOpacity={0.7}
                      onPress={() =>
                        navigation.navigate('SubjectList', {
                          yearNumber: year,
                          semesterIds: semesters.map((s) => s.id),
                          semesterNumbers: semesters.map((s) => s.number),
                        })
                      }
                    >
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardLabel}>YEAR</Text>
                        {isComingSoon && (
                          <View style={styles.comingSoonTag}>
                            <Text style={styles.comingSoonTagText}>SOON</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.cardSemesterNumber, isComingSoon && styles.cardSemesterNumberSoon]}>
                        {year}
                      </Text>
                      <Text style={styles.cardSublabel}>
                        {isComingSoon
                          ? 'Coming Soon'
                          : `${subjectCount} subject${subjectCount === 1 ? '' : 's'}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Browse All Subjects CTA Card */}
          <View style={[styles.allSubjectsCta, ctaRow && styles.allSubjectsCtaRow]}>
            <View style={[styles.allSubjectsLeft, ctaRow && styles.allSubjectsLeftRow]}>
              <Text style={styles.allSubjectsTag}>LOOKING FOR ONE SUBJECT?</Text>
              <Text style={styles.allSubjectsText}>
                Search or browse all {stats.subjects || 'hundreds of'} subjects directly.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.allSubjectsButton, ctaRow && styles.allSubjectsButtonRow]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('AllSubjects')}
            >
              <Text style={styles.allSubjectsButtonText}>Browse all subjects</Text>
              <Feather name="arrow-right" size={15} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  siteHeader: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  brandTitle: {
    fontFamily: FONTS.serif,
    fontSize: rf(20),
    fontWeight: '600',
    fontStyle: 'italic',
    color: COLORS.text,
    letterSpacing: -0.5,
    lineHeight: rf(22),
  },
  brandSubtitle: {
    fontFamily: FONTS.mono,
    fontSize: rf(8.5),
    color: COLORS.textSubtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerIconButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginLeft: 4,
  },
  headerLinkText: {
    fontSize: rf(13.5),
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  scrollContent: {
    paddingTop: verticalScale(20),
    paddingBottom: 32,
    alignItems: 'center',
  },
  centerWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 40,
  },
  heroCopyCol: {
    // Slightly greedier than the aside so the headline keeps the emphasis.
    flex: 1.15,
  },
  heroAsideCol: {
    flex: 1,
    maxWidth: 400,
  },
  heroTitle: {
    fontFamily: FONTS.serif,
    fontSize: rf(27),
    fontWeight: '400',
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: rf(34),
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: rf(13.5),
    color: COLORS.textMuted,
    marginTop: 8,
    lineHeight: rf(20),
  },
  heroSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  heroSearchPlaceholder: {
    fontFamily: FONTS.sans,
    fontSize: rf(13),
    color: COLORS.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  statChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statItem: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  statNumber: {
    color: COLORS.text,
    fontWeight: '700',
  },
  section: {
    marginTop: 24,
  },
  sectionHeading: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Cards carry an exact measured width and the container supplies the gap,
    // so nothing should be redistributed - space-between would stretch a
    // partly-filled last row.
    justifyContent: 'flex-start',
  },
  gridCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: verticalScale(18),
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCardComingSoon: {
    backgroundColor: COLORS.cardSecondary,
    borderStyle: 'dashed',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  comingSoonTag: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  comingSoonTagText: {
    fontFamily: FONTS.mono,
    fontSize: rf(8),
    color: COLORS.textSubtle,
    fontWeight: '700',
  },
  gridCardSkeleton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: verticalScale(18),
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    color: COLORS.textSubtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardSemesterNumber: {
    fontFamily: FONTS.serif,
    fontSize: rf(32),
    fontStyle: 'italic',
    fontWeight: '400',
    color: COLORS.text,
    marginVertical: 2,
  },
  cardSemesterNumberSoon: {
    color: COLORS.textMuted,
  },
  cardSublabel: {
    fontFamily: FONTS.mono,
    fontSize: rf(10),
    color: COLORS.textMuted,
  },
  allSubjectsCta: {
    marginTop: 24,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 16,
  },
  allSubjectsCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  },
  allSubjectsLeft: {
    marginBottom: 12,
  },
  allSubjectsLeftRow: {
    flex: 1,
    marginBottom: 0,
  },
  allSubjectsButtonRow: {
    // Stops the button stretching to the card's full height in row mode, and
    // keeps it from eating the space the copy needs.
    alignSelf: 'center',
    flexShrink: 0,
    gap: 10,
  },
  allSubjectsTag: {
    fontFamily: FONTS.mono,
    fontSize: rf(10),
    color: COLORS.textSubtle,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 4,
  },
  allSubjectsText: {
    fontSize: rf(13),
    color: COLORS.textMuted,
    lineHeight: rf(18),
  },
  allSubjectsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  allSubjectsButtonText: {
    fontSize: rf(13),
    fontWeight: '600',
    color: COLORS.text,
  },
});


