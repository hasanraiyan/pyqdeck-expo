import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
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

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isLandscape, isTablet, contentMaxWidth } = useResponsive();
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Site Header bar with Official PyQdeck Logo */}
      <View style={styles.siteHeader}>
        <View style={styles.headerInner}>
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
          <TouchableOpacity
            onPress={() => navigation.navigate('AllSubjects')}
            style={styles.headerLink}
          >
            <Text style={styles.headerLinkText}>Subjects</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 24 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={[styles.centerWrapper, { maxWidth: contentMaxWidth }]}>
          {/* Hero Section */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>
              BEU Previous Year{'\n'}Question Papers
            </Text>
            <Text style={styles.heroSubtitle}>
              Previous-year exam question papers for Bihar Engineering University (BEU)
              B.Tech students, sorted by semester, subject, and year.
            </Text>

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
                  <Text style={styles.statNumber}>8</Text> SEMESTERS
                </Text>
              </View>
            </View>
          </View>

          {/* Semester Selection Section */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>SELECT SEMESTER</Text>

            {loading ? (
              <View style={styles.grid}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.gridCardSkeleton,
                      (isLandscape || isTablet) && { width: '23.5%' },
                    ]}
                  >
                    <Skeleton width={50} height={10} style={{ marginBottom: 6 }} />
                    <Skeleton width={40} height={28} style={{ marginBottom: 6 }} />
                    <Skeleton width={60} height={10} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.grid}>
                {semestersData.map(({ semester, subjectCount }) => {
                  const isComingSoon = subjectCount === 0;
                  return (
                    <TouchableOpacity
                      key={semester.id}
                      style={[
                        styles.gridCard,
                        (isLandscape || isTablet) && { width: '23.5%' },
                        isComingSoon && styles.gridCardComingSoon,
                      ]}
                      activeOpacity={0.7}
                      onPress={() =>
                        navigation.navigate('SubjectList', {
                          semesterId: semester.id,
                          semesterNumber: semester.number,
                        })
                      }
                    >
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardLabel}>SEMESTER</Text>
                        {isComingSoon && (
                          <View style={styles.comingSoonTag}>
                            <Text style={styles.comingSoonTagText}>SOON</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.cardSemesterNumber, isComingSoon && styles.cardSemesterNumberSoon]}>
                        {semester.number}
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
          <View style={styles.allSubjectsCta}>
            <View style={styles.allSubjectsLeft}>
              <Text style={styles.allSubjectsTag}>LOOKING FOR ONE SUBJECT?</Text>
              <Text style={styles.allSubjectsText}>
                Search or browse all {stats.subjects || 'hundreds of'} subjects directly.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.allSubjectsButton}
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
    paddingHorizontal: 16,
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
  headerLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerLinkText: {
    fontSize: rf(13.5),
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
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
    justifyContent: 'space-between',
    rowGap: 12,
  },
  gridCard: {
    width: '48.5%',
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
    width: '48.5%',
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
  allSubjectsLeft: {
    marginBottom: 12,
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


