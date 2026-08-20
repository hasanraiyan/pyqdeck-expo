import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSubjectMeta, getQuestions } from '../api';
import { SubjectMeta, QuestionSummary } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { QuestionItem } from '../components/QuestionItem';
import { QuestionSkeleton } from '../components/Skeleton';
import { PrevNextNav } from '../components/PrevNextNav';
import { rf, verticalScale } from '../utils/responsive';

export const QuestionListScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const {
    semesterId,
    subjectId,
    subjectName,
    subjectCode,
    initialYear,
    initialChapter,
  } = route.params || {};

  const [meta, setMeta] = useState<SubjectMeta | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(
    initialYear || undefined
  );
  const [selectedChapter, setSelectedChapter] = useState<string | undefined>(
    initialChapter || undefined
  );
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const metaData = await getSubjectMeta(subjectId);
      setMeta(metaData);
      const defaultYear =
        selectedYear ?? (metaData.years[0]?.year || undefined);
      if (!selectedYear && defaultYear) {
        setSelectedYear(defaultYear);
      }
      const questionsData = await getQuestions(subjectId, {
        year: selectedYear ?? defaultYear,
        chapter: selectedChapter,
      });
      setQuestions(questionsData.questions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFilteredQuestions = async (year?: number, chapter?: string) => {
    setLoading(true);
    try {
      const questionsData = await getQuestions(subjectId, { year, chapter });
      setQuestions(questionsData.questions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subjectId]);

  const handleYearChange = (year: number) => {
    const nextYear = selectedYear === year ? undefined : year;
    setSelectedYear(nextYear);
    fetchFilteredQuestions(nextYear, selectedChapter);
  };

  const handleChapterChange = (chapter: string) => {
    const nextChapter = selectedChapter === chapter ? undefined : chapter;
    setSelectedChapter(nextChapter);
    fetchFilteredQuestions(selectedYear, nextChapter);
  };

  // Prev / Next Year Navigation
  const yearsList = meta?.years?.map((y) => y.year).sort((a, b) => a - b) || [];
  const currentYearIdx = selectedYear ? yearsList.indexOf(selectedYear) : -1;
  const prevYear = currentYearIdx > 0 ? yearsList[currentYearIdx - 1] : null;
  const nextYear =
    currentYearIdx >= 0 && currentYearIdx < yearsList.length - 1
      ? yearsList[currentYearIdx + 1]
      : null;

  const currentYearMeta = meta?.years?.find((y) => y.year === selectedYear);

  return (
    <View style={styles.container}>
      <FlatList
        data={questions}
        keyExtractor={(item) => item.questionId}
        contentContainerStyle={{ paddingBottom: 24 }}
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
        ListHeaderComponent={
          <View style={styles.headerWrapper}>
            {/* Header matching web PaperPage */}
            <View style={styles.header}>
              <Text style={styles.yearTag}>
                {selectedYear ? `${selectedYear} QUESTION PAPER` : 'ALL QUESTIONS'}
              </Text>
              <Text style={styles.title}>{meta?.name || subjectName}</Text>
              <Text style={styles.subtitle}>
                {questions.length} question{questions.length === 1 ? '' : 's'}
                {selectedYear ? ` in the ${selectedYear} exam paper.` : '.'}
              </Text>
            </View>

            {/* Filter Section: Dual scrollable chip bars */}
            {meta && (
              <View style={styles.filterSection}>
                {meta.years && meta.years.length > 0 && (
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>EXAM YEAR</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipScroll}
                    >
                      {meta.years.map((y) => {
                        const active = selectedYear === y.year;
                        return (
                          <TouchableOpacity
                            key={y.year}
                            onPress={() => handleYearChange(y.year)}
                            style={[styles.filterChip, active && styles.filterChipActive]}
                          >
                            <Text
                              style={[
                                styles.filterChipText,
                                active && styles.filterChipTextActive,
                              ]}
                            >
                              {y.year} ({y.questionCount})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {meta.chapters && meta.chapters.length > 0 && (
                  <View style={[styles.filterGroup, { borderTopWidth: 1, borderColor: COLORS.borderLight }]}>
                    <Text style={styles.filterGroupLabel}>MODULE</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipScroll}
                    >
                      <TouchableOpacity
                        onPress={() => handleChapterChange('')}
                        style={[
                          styles.filterChip,
                          !selectedChapter && styles.filterChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            !selectedChapter && styles.filterChipTextActive,
                          ]}
                        >
                          All Modules
                        </Text>
                      </TouchableOpacity>
                      {meta.chapters.map((c) => {
                        const active = selectedChapter === c.chapter;
                        return (
                          <TouchableOpacity
                            key={c.chapter}
                            onPress={() => handleChapterChange(c.chapter)}
                            style={[styles.filterChip, active && styles.filterChipActive]}
                          >
                            <Text
                              style={[
                                styles.filterChipText,
                                active && styles.filterChipTextActive,
                              ]}
                            >
                              {c.chapter} ({c.questionCount})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {loading && (
              <View style={{ paddingVertical: 8 }}>
                {[1, 2, 3, 4].map((i) => (
                  <QuestionSkeleton key={i} />
                ))}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No questions found for this selection.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          !loading && (prevYear || nextYear) ? (
            <View style={styles.footerNavWrapper}>
              <PrevNextNav
                prev={
                  prevYear
                    ? {
                        label: `${prevYear} Paper`,
                        sublabel: 'Previous year',
                        onPress: () => handleYearChange(prevYear),
                      }
                    : null
                }
                next={
                  nextYear
                    ? {
                        label: `${nextYear} Paper`,
                        sublabel: 'Next year',
                        onPress: () => handleYearChange(nextYear),
                      }
                    : null
                }
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <QuestionItem
            question={item}
            subjectId={subjectId}
            semesterId={semesterId}
            subjectName={subjectName}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerWrapper: {
    width: '100%',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
    backgroundColor: COLORS.card,
  },
  yearTag: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: rf(24),
    fontStyle: 'italic',
    fontWeight: '400',
    color: COLORS.text,
    lineHeight: rf(30),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: rf(12.5),
    color: COLORS.textMuted,
    marginTop: 4,
  },
  filterSection: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  filterGroup: {
    paddingVertical: 6,
  },
  filterGroupLabel: {
    fontFamily: FONTS.mono,
    fontSize: rf(9),
    color: COLORS.textSubtle,
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  chipScroll: {
    paddingHorizontal: 16,
    paddingVertical: 2,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 3,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: rf(11),
    fontWeight: '600',
    color: COLORS.textMuted,
    fontFamily: FONTS.mono,
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  footerNavWrapper: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  emptyState: {
    padding: 36,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: rf(13.5),
    fontStyle: 'italic',
  },
});
