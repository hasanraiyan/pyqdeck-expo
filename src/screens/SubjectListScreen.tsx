import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getSubjects } from '../api';
import { SubjectSummary } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { SubjectCardSkeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';
import { AdBanner } from '../components/AdBanner';
import { useResponsive } from '../utils/responsive';
import { semesterNumbersForYear } from '../utils/year';

export const SubjectListScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { width, bp, wideMaxWidth, hPadding } = useResponsive();
  const { yearNumber, semesterIds, semesterNumbers: passedSemNumbers } = route.params || {};

  const availableSemesters = useMemo<number[]>(() => {
    if (Array.isArray(passedSemNumbers) && passedSemNumbers.length > 0) {
      return passedSemNumbers;
    }
    if (yearNumber) {
      return semesterNumbersForYear(yearNumber);
    }
    return [];
  }, [passedSemNumbers, yearNumber]);

  const [selectedSemesterNumber, setSelectedSemesterNumber] = useState<number | null>(() => {
    if (Array.isArray(passedSemNumbers) && passedSemNumbers.length > 0) {
      return passedSemNumbers[0];
    }
    if (yearNumber) {
      return semesterNumbersForYear(yearNumber)[0];
    }
    return null;
  });

  const listRef = useRef<FlatList>(null);
  const isMultiSemester = availableSemesters.length > 1;

  useEffect(() => {
    if (availableSemesters.length > 0) {
      if (selectedSemesterNumber === null || !availableSemesters.includes(selectedSemesterNumber)) {
        setSelectedSemesterNumber(availableSemesters[0]);
      }
    }
  }, [availableSemesters]);

  // A phone keeps the dense full-bleed row list - it's the right shape for a
  // narrow column. Wider screens switch to a card grid, because a single row
  // stretched to 1200px puts the subject name and its count at opposite ends
  // of an empty band.
  const columns = bp({ phone: 1, tablet: 2, laptop: 3 });
  const isGrid = columns > 1;
  const GAP = 12;
  // The padding lives on the same box as the cap here (unlike HomeScreen,
  // where an outer padded view wraps an inner capped one), so the cap has to
  // include the padding for the usable width to come out the same on both
  // screens - otherwise the two disagree by 2 x hPadding above wideMaxWidth.
  const frameMaxWidth = wideMaxWidth + (isGrid ? hPadding * 2 : 0);
  // Measured, not window-derived: on web useWindowDimensions() includes the
  // vertical scrollbar that the content box doesn't get, and cards sized off
  // it overflow their row by ~17px - enough to wrap one card per row away.
  const [listWidth, setListWidth] = useState(0);
  const onContentLayout = useCallback(
    (e: LayoutChangeEvent) => setListWidth(e.nativeEvent.layout.width),
    []
  );
  const trackWidth = listWidth || width;
  const contentWidth =
    Math.min(trackWidth, frameMaxWidth) - (isGrid ? hPadding * 2 : 0);
  const cardWidth = isGrid ? (contentWidth - GAP * (columns - 1)) / columns : undefined;

  const [subjects, setSubjects] = useState<(SubjectSummary & { semesterId: string; semesterNumber: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!semesterIds || !Array.isArray(semesterIds)) {
      setLoading(false);
      return;
    }
    try {
      const results = await Promise.all(
        (semesterIds as string[]).map(async (id: string, idx: number) => {
          const data = await getSubjects(id);
          const semNum = availableSemesters[idx] ?? (yearNumber ? yearNumber * 2 - 1 + idx : 1);
          return data.map((subject) => ({
            ...subject,
            semesterId: id,
            semesterNumber: semNum,
          }));
        })
      );
      const merged = results
        .flat()
        .sort((a, b) => a.semesterNumber - b.semesterNumber || a.name.localeCompare(b.name));
      setSubjects(merged);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [JSON.stringify(semesterIds)]);

  const filteredSubjects = useMemo(() => {
    if (availableSemesters.length <= 1 || selectedSemesterNumber === null) {
      return subjects;
    }
    return subjects.filter((s) => s.semesterNumber === selectedSemesterNumber);
  }, [subjects, selectedSemesterNumber, availableSemesters.length]);

  const semCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const num of availableSemesters) {
      counts[num] = 0;
    }
    for (const s of subjects) {
      if (counts[s.semesterNumber] !== undefined) {
        counts[s.semesterNumber]++;
      }
    }
    return counts;
  }, [subjects, availableSemesters]);

  const handleSelectSemester = useCallback((semNum: number) => {
    if (selectedSemesterNumber !== semNum) {
      void Haptics.selectionAsync().catch(() => {});
      setSelectedSemesterNumber(semNum);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [selectedSemesterNumber]);

  const renderSubjectItem = useCallback(
    ({ item }: { item: SubjectSummary & { semesterId: string; semesterNumber: number } }) => {
      const isComingSoon = item.questionCount === 0;
      return (
        <TouchableOpacity
          style={[
            styles.card,
            isGrid && [styles.cardGrid, { width: cardWidth }],
            isComingSoon && styles.cardComingSoon,
          ]}
          activeOpacity={isComingSoon ? 1 : 0.7}
          disabled={isComingSoon}
          onPress={() =>
            navigation.navigate('SubjectDetail', {
              semesterId: item.semesterId,
              semesterNumber: item.semesterNumber,
              subjectId: item.id,
              subjectName: item.name,
              subjectCode: item.code,
            })
          }
        >
          <View style={styles.cardLeft}>
            <View style={styles.codeRow}>
              {item.code ? <Badge label={item.code} variant="secondary" /> : null}
              {isComingSoon && (
                <View style={styles.cardSoonTag}>
                  <Text style={styles.cardSoonTagText}>SOON</Text>
                </View>
              )}
            </View>
            <Text style={[styles.subjectName, isComingSoon && styles.subjectNameSoon]}>
              {item.name}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.questionCountText}>
              {isComingSoon ? 'Coming Soon' : `${item.questionCount}q`}
            </Text>
            {!isComingSoon && (
              <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [navigation, isGrid, cardWidth]
  );

  return (
    <View style={styles.container}>
      {/* The bar stays full-bleed; its text is capped to the same width as the
          list below so the heading doesn't hug the edge on a wide screen. */}
      <View style={styles.header}>
        <View
          style={[
            styles.headerInner,
            { maxWidth: wideMaxWidth + hPadding * 2, paddingHorizontal: hPadding },
          ]}
        >
          <Text style={styles.badgeText}>YEAR {yearNumber}</Text>
          <Text style={styles.title}>Subjects</Text>
          <Text style={styles.subtitle}>
            Select a subject to browse year-wise questions and practice by module.
          </Text>
        </View>
      </View>

      {/* Top Navigation Tabs for Semesters (e.g. Sem 5 and Sem 6) */}
      {availableSemesters.length > 1 && (
        <View style={styles.tabBarWrapper}>
          <View
            style={[
              styles.tabBarInner,
              {
                maxWidth: frameMaxWidth,
                paddingHorizontal: isGrid ? hPadding : 16,
              },
            ]}
          >
            <View style={styles.segmentedControl}>
              {availableSemesters.map((semNum) => {
                const isSelected = selectedSemesterNumber === semNum;
                const count = semCounts[semNum] ?? 0;
                return (
                  <TouchableOpacity
                    key={semNum}
                    style={[styles.segmentBtn, isSelected && styles.segmentBtnActive]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectSemester(semNum)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Semester ${semNum}`}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        isSelected && styles.segmentBtnTextActive,
                      ]}
                    >
                      Semester {semNum}
                    </Text>
                    {!loading && (
                      <View
                        style={[
                          styles.segmentBadge,
                          isSelected && styles.segmentBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentBadgeText,
                            isSelected && styles.segmentBadgeTextActive,
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      )}

      <View style={styles.content} onLayout={onContentLayout}>
        {loading ? (
          <View style={{ maxWidth: frameMaxWidth, width: '100%', alignSelf: 'center' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SubjectCardSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={filteredSubjects}
            // FlatList caches its layout per column count, so it has to be
            // remounted when that changes - otherwise rotating a tablet (or
            // dragging a browser window across a breakpoint) leaves the old
            // single-column layout behind.
            key={columns}
            numColumns={columns}
            columnWrapperStyle={isGrid ? { gap: GAP } : undefined}
            keyExtractor={(item) => item.id}
            renderItem={renderSubjectItem}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={{
              paddingBottom: 24,
              paddingTop: isGrid ? GAP : 0,
              paddingHorizontal: isGrid ? hPadding : 0,
              maxWidth: frameMaxWidth,
              width: '100%',
              alignSelf: 'center',
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData();
                }}
                tintColor={COLORS.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.comingSoonContainer}>
                <View style={styles.comingSoonBadge}>
                  <Feather name="clock" size={14} color={COLORS.primary} />
                  <Text style={styles.comingSoonBadgeText}>COMING SOON</Text>
                </View>
                <Text style={styles.comingSoonTitle}>
                  {selectedSemesterNumber
                    ? `No Semester ${selectedSemesterNumber} subjects yet`
                    : 'No subjects added yet'}
                </Text>
                <Text style={styles.comingSoonDesc}>
                  {selectedSemesterNumber
                    ? `We are actively curating previous year questions for Semester ${selectedSemesterNumber}. Switch semesters above or browse other active subjects.`
                    : `We are actively curating previous year questions for Year ${yearNumber}. Check back soon or browse other active years.`}
                </Text>
                <TouchableOpacity
                  style={styles.browseAllBtn}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('AllSubjects')}
                >
                  <Text style={styles.browseAllBtnText}>Browse all available subjects</Text>
                  <Feather name="arrow-right" size={14} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>
      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
  },
  tabBarWrapper: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabBarInner: {
    width: '100%',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      },
      android: {
        elevation: 1.5,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      },
    }),
  },
  segmentBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  segmentBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  segmentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  segmentBadgeActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryBorder,
  },
  segmentBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.textSubtle,
  },
  segmentBadgeTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  badgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 27,
    fontStyle: 'italic',
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  // Grid mode: a standalone bordered card rather than a full-bleed row with
  // only a bottom rule.
  cardGrid: {
    borderWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 4,
    marginBottom: 12,
  },
  cardComingSoon: {
    backgroundColor: COLORS.cardSecondary,
    opacity: 0.85,
  },
  cardSoonTag: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  cardSoonTagText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: COLORS.textSubtle,
  },
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  subjectName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 19,
  },
  subjectNameSoon: {
    color: COLORS.textMuted,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionCountText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  comingSoonContainer: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 24,
    alignItems: 'center',
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  comingSoonBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  comingSoonTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    fontStyle: 'italic',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  comingSoonDesc: {
    fontSize: 13.5,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: 20,
  },
  browseAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  browseAllBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
});
