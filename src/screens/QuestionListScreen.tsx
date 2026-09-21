import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
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
  Platform,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getSubjectMeta, getQuestions } from '../api';
import { SubjectMeta, QuestionSummary } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { QuestionItem } from '../components/QuestionItem';
import { QuestionItemClassic } from '../components/QuestionItemClassic';
import { WaveLoader } from '../components/WaveLoader';
import { PrevNextNav } from '../components/PrevNextNav';
import { AdBanner } from '../components/AdBanner';
import { VolumeScrollHint } from '../components/VolumeScrollHint';
import { rf, verticalScale, useResponsive } from '../utils/responsive';
import { useVolumeScroll } from '../utils/volumeScroll';
import { getOldUiEnabled } from '../utils/settings';
import { recordRecentStudy } from '../utils/recentStudy';

const VOLUME_SCROLL_STEP = 320;

export const QuestionListScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { readMaxWidth, bp } = useResponsive();
  const showFilterText = bp({ phone: false, tablet: true });
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
  const [isOldUi, setIsOldUi] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getOldUiEnabled().then(setIsOldUi);
    }, [])
  );
  // Draft selections inside the filter sheet - chip taps only update these,
  // not selectedYear/selectedChapter, so browsing the sheet (tapping
  // several years/modules before deciding) doesn't fire an API call per
  // tap. Only "Show Results" commits the draft and fetches once.
  const [draftYear, setDraftYear] = useState<number | undefined>(selectedYear);
  const [draftChapter, setDraftChapter] = useState<string | undefined>(selectedChapter);

  const openFilterModal = () => {
    setDraftYear(selectedYear);
    setDraftChapter(selectedChapter);
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    setSelectedYear(draftYear);
    setSelectedChapter(draftChapter);
    fetchFilteredQuestions(draftYear, draftChapter);
    setFilterModalVisible(false);
  };

  const loadData = async (forceRefresh = false) => {
    try {
      const metaData = await getSubjectMeta(subjectId, forceRefresh);
      setMeta(metaData);

      // Only default to first year if neither a specific year NOR a specific chapter was requested
      const shouldDefaultYear = selectedYear === undefined && selectedChapter === undefined;
      const defaultYear = shouldDefaultYear ? (metaData.years[0]?.year || undefined) : undefined;

      if (shouldDefaultYear && defaultYear) {
        setSelectedYear(defaultYear);
      }

      const queryYear = selectedYear ?? defaultYear;
      const questionsData = await getQuestions(
        subjectId,
        { year: queryYear, chapter: selectedChapter },
        forceRefresh
      );
      setQuestions(questionsData.questions);

      if (metaData) {
        void recordRecentStudy({
          subjectId,
          subjectName: metaData.name || subjectName,
          semesterId,
          subjectCode: metaData.code || subjectCode,
          year: queryYear,
        });
      }
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
    if (year === selectedYear) return;
    Haptics.selectionAsync();
    setSelectedYear(year);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    fetchFilteredQuestions(year, selectedChapter);
    void recordRecentStudy({
      subjectId,
      subjectName: meta?.name || subjectName,
      semesterId,
      subjectCode: meta?.code || subjectCode,
      year,
    });
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

  const renderItem = useCallback(
    ({ item }: { item: QuestionSummary }) =>
      isOldUi ? (
        <QuestionItemClassic
          question={item}
          subjectId={subjectId}
          semesterId={semesterId}
          subjectName={subjectName}
          hideYearBadge={false}
        />
      ) : (
        <QuestionItem
          question={item}
          subjectId={subjectId}
          semesterId={semesterId}
          subjectName={subjectName}
          hideYearBadge={false}
        />
      ),
    [isOldUi, subjectId, semesterId, subjectName]
  );

  const hasActiveFilters = Boolean(selectedChapter || selectedYear);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={[
            styles.headerFilterBtn,
            !showFilterText && styles.headerFilterBtnIconOnly,
            hasActiveFilters && styles.headerFilterBtnActive,
          ]}
          onPress={openFilterModal}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Filter questions"
        >
          <Feather
            name="sliders"
            size={15}
            color={hasActiveFilters ? COLORS.primary : COLORS.text}
          />
          {showFilterText && (
            <Text style={[styles.headerFilterText, hasActiveFilters && styles.headerFilterTextActive]}>
              Filter
            </Text>
          )}
          {hasActiveFilters && !showFilterText && (
            <View style={styles.activeFilterDot} />
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, hasActiveFilters, openFilterModal, showFilterText]);

  const listRef = useRef<FlatList>(null);
  const scrollOffsetRef = useRef(0);
  const [showVolumeHint, setShowVolumeHint] = useState(false);

  useVolumeScroll(
    useCallback((direction) => {
      const delta = direction === 'down' ? VOLUME_SCROLL_STEP : -VOLUME_SCROLL_STEP;
      const nextOffset = Math.max(0, scrollOffsetRef.current + delta);
      listRef.current?.scrollToOffset({ offset: nextOffset, animated: true });
    }, []),
    useCallback(() => setShowVolumeHint(true), [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {meta?.years && meta.years.length > 0 && (
          <View style={styles.yearBarWrapper}>
            <View style={[styles.yearBarInner, { maxWidth: readMaxWidth }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.yearBarScroll}
              >
                <TouchableOpacity
                  style={[styles.yearChip, !selectedYear && styles.yearChipActive]}
                  onPress={() => handleYearSelect(undefined)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.yearChipText, !selectedYear && styles.yearChipTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {meta.years.map((y) => {
                  const active = selectedYear === y.year;
                  return (
                    <TouchableOpacity
                      key={y.year}
                      style={[styles.yearChip, active && styles.yearChipActive]}
                      onPress={() => handleYearSelect(y.year)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.yearChipText, active && styles.yearChipTextActive]}>
                        {y.year}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}
        <FlatList
        ref={listRef}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
        data={questions}
        keyExtractor={(item) => item.questionId}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={false}
        contentContainerStyle={[
          {
            // Classic cards carry only marginBottom, so give the first one
            // breathing room from the year bar; accordion rows are flush by design.
            paddingTop: isOldUi ? 12 : 0,
            paddingBottom: 24,
            maxWidth: readMaxWidth,
            width: '100%',
            alignSelf: 'center',
          },
          questions.length === 0 && { flexGrow: 1 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(true);
            }}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          loading && questions.length > 0 ? (
            <View style={styles.headerLoaderWrapper}>
              <WaveLoader color={COLORS.primary} dotSize={5} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerContainer}>
              <WaveLoader color={COLORS.primary} dotSize={7} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No questions found for this selection.</Text>
            </View>
          )
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
      />
      </View>

      <AdBanner />

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
              <View
                style={[
                  styles.modalContent,
                  { paddingBottom: insets.bottom + 16, maxWidth: readMaxWidth, width: '100%', alignSelf: 'center' },
                ]}
              >
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
                            const active = draftYear === y.year;
                            return (
                              <TouchableOpacity
                                key={y.year}
                                style={[styles.modalChip, active && styles.modalChipActive]}
                                onPress={() => {
                                  setDraftYear(active ? undefined : y.year);
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
                            style={[styles.modalChip, !draftChapter && styles.modalChipActive]}
                            onPress={() => setDraftChapter(undefined)}
                          >
                            <Text style={[styles.modalChipText, !draftChapter && styles.modalChipTextActive]}>
                              All Modules
                            </Text>
                          </TouchableOpacity>
                          {meta.chapters.map((c) => {
                            const active = draftChapter === c.chapter;
                            return (
                              <TouchableOpacity
                                key={c.chapter}
                                style={[styles.modalChip, active && styles.modalChipActive]}
                                onPress={() => {
                                  setDraftChapter(active ? undefined : c.chapter);
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

                <TouchableOpacity style={styles.applyFilterBtn} onPress={applyFilters}>
                  <Text style={styles.applyFilterBtnText}>Show Results</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <VolumeScrollHint
        visible={showVolumeHint}
        onHide={() => setShowVolumeHint(false)}
        bottomOffset={insets.bottom + 16}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  yearBarWrapper: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  yearBarInner: {
    width: '100%',
  },
  yearBarScroll: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  yearChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  yearChipText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  yearChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  headerLoaderWrapper: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSecondary,
    marginRight: 6,
  },
  headerFilterBtnIconOnly: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    position: 'relative',
    gap: 0,
  },
  headerFilterBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  activeFilterDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5,
    borderColor: COLORS.cardSecondary,
  },
  headerFilterText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11.5),
    fontWeight: '700',
    color: COLORS.text,
  },
  headerFilterTextActive: {
    color: COLORS.primary,
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
