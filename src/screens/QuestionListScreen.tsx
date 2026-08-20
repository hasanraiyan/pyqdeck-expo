import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const loadData = async () => {
    try {
      const metaData = await getSubjectMeta(subjectId);
      setMeta(metaData);

      // Only default to first year if neither a specific year NOR a specific chapter was requested
      const shouldDefaultYear = selectedYear === undefined && selectedChapter === undefined;
      const defaultYear = shouldDefaultYear ? (metaData.years[0]?.year || undefined) : undefined;
      
      if (shouldDefaultYear && defaultYear) {
        setSelectedYear(defaultYear);
      }

      const queryYear = selectedYear ?? defaultYear;
      const questionsData = await getQuestions(subjectId, {
        year: queryYear,
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
    setSelectedYear(initialYear || undefined);
    setSelectedChapter(initialChapter || undefined);
    loadData();
  }, [subjectId, initialYear, initialChapter]);

  const handleYearSelect = (year?: number) => {
    setSelectedYear(year);
    fetchFilteredQuestions(year, selectedChapter);
  };

  const handleChapterSelect = (chapter?: string) => {
    setSelectedChapter(chapter);
    fetchFilteredQuestions(selectedYear, chapter);
  };

  // Prev / Next Year Navigation
  const yearsList = meta?.years?.map((y) => y.year).sort((a, b) => a - b) || [];
  const currentYearIdx = selectedYear ? yearsList.indexOf(selectedYear) : -1;
  const prevYear = currentYearIdx > 0 ? yearsList[currentYearIdx - 1] : null;
  const nextYear =
    currentYearIdx >= 0 && currentYearIdx < yearsList.length - 1
      ? yearsList[currentYearIdx + 1]
      : null;

  const hasActiveFilters = Boolean(selectedChapter || selectedYear);

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
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTopRow}>
                <Text style={styles.yearTag} numberOfLines={1}>
                  {selectedYear
                    ? `${selectedYear} QUESTION PAPER`
                    : selectedChapter
                    ? `${selectedChapter.toUpperCase()} QUESTIONS`
                    : 'ALL QUESTIONS'}
                </Text>
                <TouchableOpacity
                  style={[styles.filterIconButton, hasActiveFilters && styles.filterIconButtonActive]}
                  onPress={() => setFilterModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name="sliders"
                    size={14}
                    color={hasActiveFilters ? COLORS.primary : COLORS.text}
                  />
                  <Text style={[styles.filterIconText, hasActiveFilters && styles.filterIconTextActive]}>
                    Filter
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.title}>{meta?.name || subjectName}</Text>
              <Text style={styles.subtitle}>
                {questions.length} question{questions.length === 1 ? '' : 's'}
                {selectedYear && selectedChapter
                  ? ` in ${selectedYear} for ${selectedChapter}.`
                  : selectedYear
                  ? ` in the ${selectedYear} paper.`
                  : selectedChapter
                  ? ` across all years for ${selectedChapter}.`
                  : ' across all papers.'}
              </Text>

              {/* Active Filter summary pills */}
              {(selectedYear || selectedChapter) && (
                <View style={styles.activePillsRow}>
                  {selectedYear ? (
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>{selectedYear}</Text>
                    </View>
                  ) : null}
                  {selectedChapter ? (
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText} numberOfLines={1}>
                        {selectedChapter}
                      </Text>
                      <TouchableOpacity onPress={() => handleChapterSelect(undefined)}>
                        <Feather name="x" size={12} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            {loading && (
              <View>
                {[1, 2, 3, 4, 5, 6].map((i) => (
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
                        onPress: () => handleYearSelect(prevYear),
                      }
                    : null
                }
                next={
                  nextYear
                    ? {
                        label: `${nextYear} Paper`,
                        sublabel: 'Next year',
                        onPress: () => handleYearSelect(nextYear),
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
            hideYearBadge={Boolean(selectedYear)}
          />
        )}
      />

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTag}>FILTER QUESTIONS</Text>
                    <Text style={styles.modalTitle}>Refine Paper</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setFilterModalVisible(false)}
                    style={styles.modalCloseBtn}
                  >
                    <Feather name="x" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                {meta && (
                  <ScrollView style={styles.modalBody}>
                    {/* Year section */}
                    {meta.years && meta.years.length > 0 && (
                      <View style={styles.filterModalSection}>
                        <Text style={styles.filterSectionTitle}>EXAM YEAR</Text>
                        <View style={styles.filterChipGrid}>
                          {meta.years.map((y) => {
                            const active = selectedYear === y.year;
                            return (
                              <TouchableOpacity
                                key={y.year}
                                style={[styles.modalChip, active && styles.modalChipActive]}
                                onPress={() => {
                                  handleYearSelect(active ? undefined : y.year);
                                }}
                              >
                                <Text style={[styles.modalChipText, active && styles.modalChipTextActive]}>
                                  {y.year} ({y.questionCount})
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Module / Chapter Section */}
                    {meta.chapters && meta.chapters.length > 0 && (
                      <View style={styles.filterModalSection}>
                        <Text style={styles.filterSectionTitle}>MODULE / TOPIC</Text>
                        <View style={styles.filterChipGrid}>
                          <TouchableOpacity
                            style={[styles.modalChip, !selectedChapter && styles.modalChipActive]}
                            onPress={() => handleChapterSelect(undefined)}
                          >
                            <Text style={[styles.modalChipText, !selectedChapter && styles.modalChipTextActive]}>
                              All Modules
                            </Text>
                          </TouchableOpacity>
                          {meta.chapters.map((c) => {
                            const active = selectedChapter === c.chapter;
                            return (
                              <TouchableOpacity
                                key={c.chapter}
                                style={[styles.modalChip, active && styles.modalChipActive]}
                                onPress={() => {
                                  handleChapterSelect(active ? undefined : c.chapter);
                                }}
                              >
                                <Text style={[styles.modalChipText, active && styles.modalChipTextActive]}>
                                  {c.chapter} ({c.questionCount})
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </ScrollView>
                )}

                <TouchableOpacity
                  style={styles.applyFilterBtn}
                  onPress={() => setFilterModalVisible(false)}
                >
                  <Text style={styles.applyFilterBtnText}>Show Results ({questions.length})</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  yearTag: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingRight: 8,
  },
  filterIconButton: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  filterIconButtonActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterIconText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '600',
    color: COLORS.text,
  },
  filterIconTextActive: {
    color: COLORS.primary,
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
  activePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  activePillText: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    color: COLORS.text,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '80%',
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  modalTag: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  modalTitle: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    fontStyle: 'italic',
    color: COLORS.text,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    paddingVertical: 12,
  },
  filterModalSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1,
    marginBottom: 8,
  },
  filterChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modalChipText: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  modalChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  applyFilterBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  applyFilterBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
