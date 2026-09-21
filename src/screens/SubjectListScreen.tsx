import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
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

const Tab = createMaterialTopTabNavigator();

interface SemesterTabContentProps {
  semesterNumber: number;
  subjects: (SubjectSummary & { semesterId: string; semesterNumber: number })[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  isGrid: boolean;
  columns: number;
  cardWidth?: number;
  frameMaxWidth: number;
  GAP: number;
  hPadding: number;
  yearNumber: number;
  navigation: any;
}

const SemesterTabContent = ({
  semesterNumber,
  subjects,
  loading,
  refreshing,
  onRefresh,
  isGrid,
  columns,
  cardWidth,
  frameMaxWidth,
  GAP,
  hPadding,
  yearNumber,
  navigation,
}: SemesterTabContentProps) => {
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
    <View style={styles.tabContent}>
      {loading ? (
        <View style={{ maxWidth: frameMaxWidth, width: '100%', alignSelf: 'center', paddingTop: 8 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SubjectCardSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={subjects}
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
              onRefresh={onRefresh}
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
                {`No Semester ${semesterNumber} subjects yet`}
              </Text>
              <Text style={styles.comingSoonDesc}>
                {`We are actively curating previous year questions for Semester ${semesterNumber}. Check back soon or switch semesters.`}
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
  );
};

export const SubjectListScreen = () => {
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

  const columns = bp({ phone: 1, tablet: 2, laptop: 3 });
  const isGrid = columns > 1;
  const GAP = 12;
  const frameMaxWidth = wideMaxWidth + (isGrid ? hPadding * 2 : 0);
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

  const loadData = useCallback(async (isManual = false) => {
    if (!semesterIds || !Array.isArray(semesterIds)) {
      setLoading(false);
      return;
    }
    if (isManual) setRefreshing(true);
    try {
      const results = await Promise.all(
        (semesterIds as string[]).map(async (id: string, idx: number) => {
          const data = await getSubjects(id, isManual);
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
  }, [semesterIds, availableSemesters, yearNumber]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const subjectsBySemester = useMemo(() => {
    const map: Record<number, (SubjectSummary & { semesterId: string; semesterNumber: number })[]> = {};
    for (const num of availableSemesters) {
      map[num] = [];
    }
    for (const s of subjects) {
      if (map[s.semesterNumber]) {
        map[s.semesterNumber].push(s);
      }
    }
    return map;
  }, [subjects, availableSemesters]);

  const semCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const num of availableSemesters) {
      counts[num] = (subjectsBySemester[num] || []).length;
    }
    return counts;
  }, [subjectsBySemester, availableSemesters]);

  return (
    <View style={styles.container} onLayout={onContentLayout}>
      {availableSemesters.length > 1 ? (
        <Tab.Navigator
          initialRouteName={`Semester${availableSemesters[0]}`}
          screenOptions={{
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textMuted,
            tabBarPressColor: COLORS.primaryLight,
            tabBarIndicatorStyle: {
              backgroundColor: COLORS.primary,
              height: 2.5,
            },
            tabBarStyle: {
              backgroundColor: COLORS.card,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.borderDashed,
              elevation: 0,
              shadowOpacity: 0,
            },
            tabBarLabelStyle: {
              textTransform: 'none',
            },
          }}
        >
          {availableSemesters.map((semNum) => (
            <Tab.Screen
              key={semNum}
              name={`Semester${semNum}`}
              listeners={{
                tabPress: () => {
                  void Haptics.selectionAsync().catch(() => {});
                },
              }}
              options={{
                tabBarLabel: ({ focused, color }) => {
                  const count = semCounts[semNum] ?? 0;
                  return (
                    <View style={styles.tabLabelRow}>
                      <Text
                        style={[
                          styles.tabLabelText,
                          { color },
                          focused && styles.tabLabelTextActive,
                        ]}
                      >
                        Semester {semNum}
                      </Text>
                      {!loading && (
                        <View style={[styles.tabBadge, focused && styles.tabBadgeActive]}>
                          <Text
                            style={[
                              styles.tabBadgeText,
                              focused && styles.tabBadgeTextActive,
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                },
              }}
            >
              {() => (
                <SemesterTabContent
                  semesterNumber={semNum}
                  subjects={subjectsBySemester[semNum] || []}
                  loading={loading}
                  refreshing={refreshing}
                  onRefresh={() => loadData(true)}
                  isGrid={isGrid}
                  columns={columns}
                  cardWidth={cardWidth}
                  frameMaxWidth={frameMaxWidth}
                  GAP={GAP}
                  hPadding={hPadding}
                  yearNumber={yearNumber}
                  navigation={navigation}
                />
              )}
            </Tab.Screen>
          ))}
        </Tab.Navigator>
      ) : (
        <SemesterTabContent
          semesterNumber={availableSemesters[0] ?? (yearNumber ? yearNumber * 2 - 1 : 1)}
          subjects={subjects}
          loading={loading}
          refreshing={refreshing}
          onRefresh={() => loadData(true)}
          isGrid={isGrid}
          columns={columns}
          cardWidth={cardWidth}
          frameMaxWidth={frameMaxWidth}
          GAP={GAP}
          hPadding={hPadding}
          yearNumber={yearNumber}
          navigation={navigation}
        />
      )}
      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabContent: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabLabelText: {
    fontFamily: FONTS.mono,
    fontSize: 12.5,
    fontWeight: '600',
  },
  tabLabelTextActive: {
    fontWeight: '700',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  tabBadgeActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryBorder,
  },
  tabBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.textSubtle,
  },
  tabBadgeTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
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
