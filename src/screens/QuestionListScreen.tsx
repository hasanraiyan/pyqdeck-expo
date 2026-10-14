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
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useSubjectMeta, questionsQuery, paperStatusQuery } from '../api/queries';
import { qk } from '../api/queryKeys';
import { SubjectMeta, QuestionSummary } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { QuestionItem } from '../components/QuestionItem';
import { QuestionItemClassic } from '../components/QuestionItemClassic';
import { WaveLoader } from '../components/WaveLoader';
import { CircleLoader } from '../components/CircleLoader';
import { PrevNextNav } from '../components/PrevNextNav';
import { AdBanner } from '../components/AdBanner';
import { VolumeScrollHint } from '../components/VolumeScrollHint';
import { QuestionLayoutPromptModal } from '../components/QuestionLayoutPromptModal';
import { rf, verticalScale, useResponsive } from '../utils/responsive';
import { useVolumeScroll } from '../utils/volumeScroll';
import {
  getOldUiEnabled,
  peekOldUiEnabled,
  setOldUiEnabled,
  hasChosenQuestionLayout,
  markQuestionLayoutChosen,
} from '../utils/settings';
import { recordRecentStudy } from '../utils/recentStudy';
import { useDialogLayout } from '../utils/dialog';
import { useRequireAuth } from '../auth/useRequireAuth';
import { hasPlaceholderPaper } from '../utils/originalPaperPlaceholder';
import { useAdminAccess } from '../admin/useAdminAccess';
import { can } from '../admin/adminLogic';
import { ManagePaperSheet } from '../components/ManagePaperSheet';
import { ManageQuestionSheet } from '../components/ManageQuestionSheet';
import { ManagePyqSubjectSheet } from '../components/ManagePyqSubjectSheet';
import { EditorModal } from '../admin/EditorFrame';
import { suggestQuestionId } from '../admin/contentLogic';
import { UploadPaperModal } from '../components/UploadPaperModal';
import { useAppConfig } from '../config/useAppConfig';

const VOLUME_SCROLL_STEP = 320;

export const QuestionListScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { readMaxWidth, bp } = useResponsive();
  const showFilterText = bp({ phone: false, tablet: true });
  const dlg = useDialogLayout();
  const { flags } = useAppConfig();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const { guard } = useRequireAuth();
  const queryClient = useQueryClient();
  const admin = useAdminAccess();
  const {
    semesterId,
    subjectId,
    subjectName,
    subjectCode,
    initialYear,
    initialChapter,
  } = route.params || {};

  const metaQ = useSubjectMeta(subjectId);
  const meta: SubjectMeta | null = metaQ.data ?? null;
  const [selectedYear, setSelectedYear] = useState<number | undefined>(
    initialYear || undefined
  );
  const [selectedChapter, setSelectedChapter] = useState<string | undefined>(
    initialChapter || undefined
  );
  // Paper management for admins (FR-PAPER-15): the server re-checks the grant
  // on every call; this only decides whether the entry is shown.
  const canManagePapers = can(admin.tools, 'manage_papers', 'upload');
  const paperStatusQ = useQuery({
    ...paperStatusQuery(subjectId, selectedYear ?? 0, canManagePapers),
    enabled: !!subjectId && selectedYear != null,
  });
  const [manageOpen, setManageOpen] = useState(false);
  // Question and subject editing for admins (the server re-checks every grant).
  const canAddQuestion = can(admin.tools, 'manage_content', 'create');
  const canEditSubject = can(admin.tools, 'manage_catalog', 'update');
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const hasServerPaper = paperStatusQ.data?.hasOriginal ?? false;
  const showViewBtn = selectedYear != null && (hasPlaceholderPaper() || hasServerPaper);
  // False until the default year (from meta) has been decided, so the first
  // question fetch isn't fired for "all years" and then again for the default.
  const [yearResolved, setYearResolved] = useState(Boolean(initialYear || initialChapter));
  const questionsQ = useQuery({
    ...questionsQuery(subjectId, { year: selectedYear, chapter: selectedChapter }),
    enabled: !!subjectId && yearResolved,
    placeholderData: keepPreviousData,
  });
  const questions: QuestionSummary[] = questionsQ.data?.questions ?? [];
  const loading = !yearResolved || questionsQ.isPending || questionsQ.isPlaceholderData;
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  // null only on the very first open of the session, before the saved layout has
  // been read (App.tsx primes it at launch, so normally it is already known).
  const [oldUiPref, setOldUiPref] = useState<boolean | null>(peekOldUiEnabled);
  const isOldUi = oldUiPref === true;
  const [layoutPromptVisible, setLayoutPromptVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getOldUiEnabled().then(setOldUiPref);
      hasChosenQuestionLayout().then((chosen) => {
        if (!chosen) {
          setLayoutPromptVisible(true);
        }
      });
    }, [])
  );

  const handleSelectLayoutMode = async (isCards: boolean) => {
    setOldUiPref(isCards);
    setLayoutPromptVisible(false);
    await setOldUiEnabled(isCards);
    await markQuestionLayoutChosen();
  };
  // Draft selections inside the filter sheet - chip taps only update these,
  // not selectedYear/selectedChapter, so browsing the sheet (tapping
  // several years/modules before deciding) doesn't fire an API call per
  // tap. Only "Show Results" commits the draft and fetches once.
  const [draftYear, setDraftYear] = useState<number | undefined>(selectedYear);
  const [draftChapter, setDraftChapter] = useState<string | undefined>(selectedChapter);

  // Stable identity: the header button below depends on it, and a fresh
  // function every render made the header re-apply its options on each one.
  const openFilterModal = useCallback(() => {
    setDraftYear(selectedYear);
    setDraftChapter(selectedChapter);
    setFilterModalVisible(true);
  }, [selectedYear, selectedChapter]);

  const applyFilters = () => {
    setSelectedYear(draftYear);
    setSelectedChapter(draftChapter);
    setFilterModalVisible(false);
  };

  // Reset when the route params change (same screen instance, new subject/filter).
  useEffect(() => {
    setSelectedYear(initialYear || undefined);
    setSelectedChapter(initialChapter || undefined);
    setYearResolved(Boolean(initialYear || initialChapter));
  }, [subjectId, initialYear, initialChapter]);

  // Only default to the latest year if neither a specific year NOR a specific
  // chapter was requested. Resolved once per subject so that a later explicit
  // "All years" pick isn't re-defaulted.
  useEffect(() => {
    if (yearResolved || !meta) return;
    const defaultYear = meta.years[0]?.year || undefined;
    if (defaultYear) setSelectedYear(defaultYear);
    setYearResolved(true);
  }, [meta, yearResolved]);

  useEffect(() => {
    if (!meta || !yearResolved) return;
    void recordRecentStudy({
      subjectId,
      subjectName: meta.name || subjectName,
      semesterId,
      subjectCode: meta.code || subjectCode,
      year: selectedYear,
    });
    // Record once per subject visit; year picks are recorded in handleYearSelect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.id, yearResolved]);

  const handleYearSelect = (year?: number) => {
    if (year === selectedYear) return;
    Haptics.selectionAsync();
    setSelectedYear(year);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
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

  // Paper-level original scan for the selected year, pushed as a headerless
  // route (fullscreen, own top bar, no tab bar). Sign-in is required
  // (FR-PAPER-8); availability is placeholder-gated in dev until the real
  // backend lands.
  const openOriginalPaper = useCallback(() => {
    if (selectedYear == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    guard(
      () =>
        navigation.navigate('OriginalPaper', {
          subjectId,
          subjectName,
          year: selectedYear,
        }),
      'paper'
    );
  }, [guard, navigation, selectedYear, subjectId, subjectName]);

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
        data={oldUiPref === null ? [] : questions}
        keyExtractor={(item) => item.questionId}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
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
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await Promise.all([metaQ.refetch(), questionsQ.refetch()]);
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <>
            {showViewBtn && (
              <View style={styles.paperBtnWrapper}>
                <TouchableOpacity
                  style={styles.paperBtn}
                  activeOpacity={0.7}
                  onPress={openOriginalPaper}
                  accessibilityRole="button"
                  accessibilityLabel={`View original paper for ${selectedYear}`}
                >
                  <Feather name="eye" size={14} color="#ffffff" />
                  <Text style={styles.paperBtnText}>View Original Paper</Text>
                </TouchableOpacity>
              </View>
            )}
            {!loading && selectedYear != null && flags.paperUploadEnabled !== false && (
              <View style={styles.paperBtnWrapper}>
                <TouchableOpacity
                  style={styles.manageBtn}
                  activeOpacity={0.7}
                  onPress={() => setUploadModalOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Upload exam paper for ${selectedYear}`}
                >
                  <Feather name="upload-cloud" size={14} color={COLORS.primary} />
                  <Text style={styles.manageBtnText}>
                    {hasServerPaper ? 'Contribute paper copy' : 'Upload exam paper'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {selectedYear != null && canManagePapers && (
              <View style={styles.paperBtnWrapper}>
                <TouchableOpacity
                  style={styles.manageBtn}
                  activeOpacity={0.7}
                  onPress={() => setManageOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Manage original paper for ${selectedYear}`}
                >
                  <Feather name={hasServerPaper ? 'layers' : 'upload'} size={14} color={COLORS.primary} />
                  <Text style={styles.manageBtnText}>
                    {hasServerPaper ? 'Manage paper' : 'Upload paper'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {(canAddQuestion || canEditSubject) && (
              <View style={[styles.paperBtnWrapper, { flexDirection: 'row', gap: 8 }]}>
                {canAddQuestion && (
                  <TouchableOpacity
                    style={[styles.manageBtn, { flex: 1 }]}
                    activeOpacity={0.7}
                    onPress={() => setAddQuestionOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Add a question to this subject"
                  >
                    <Feather name="plus" size={14} color={COLORS.primary} />
                    <Text style={styles.manageBtnText}>Add question</Text>
                  </TouchableOpacity>
                )}
                {canEditSubject && (
                  <TouchableOpacity
                    style={[styles.manageBtn, { flex: 1 }]}
                    activeOpacity={0.7}
                    onPress={() => setEditSubjectOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Edit this subject"
                  >
                    <Feather name="edit-2" size={14} color={COLORS.primary} />
                    <Text style={styles.manageBtnText}>Edit subject</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {loading && questions.length > 0 ? (
              <View style={styles.headerLoaderWrapper}>
                <WaveLoader color={COLORS.primary} dotSize={5} />
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading || oldUiPref === null ? (
            <View style={styles.centerContainer}>
              <CircleLoader color={COLORS.primary} dotSize={6} size={40} />
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

      {/* Paper manage sheet (admins): upload / replace / remove scans. */}
      <Modal
        visible={manageOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setManageOpen(false)}
      >
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: COLORS.background }}>
          {selectedYear != null && (
            <ManagePaperSheet
              subjectId={subjectId}
              subjectName={subjectName}
              year={selectedYear}
              status={paperStatusQ.data}
              onChanged={() => {
                void queryClient.invalidateQueries({
                  queryKey: qk.paperStatus(subjectId, selectedYear),
                });
                // The viewer's signed pages are cached for minutes; a replaced
                // or removed paper must not keep showing the old ones. Prefix
                // match covers both the signed-in and signed-out variants.
                void queryClient.invalidateQueries({
                  queryKey: ['paperPages', subjectId, selectedYear],
                });
              }}
              onClose={() => setManageOpen(false)}
            />
          )}
        </View>
      </Modal>

      <EditorModal visible={addQuestionOpen} onRequestClose={() => setAddQuestionOpen(false)}>
        <ManageQuestionSheet
          subjectId={subjectId}
          subjectName={subjectName}
          suggestedId={suggestQuestionId(questions.map((q) => q.questionId))}
          suggestedYear={selectedYear}
          onSaved={() => setAddQuestionOpen(false)}
          onClose={() => setAddQuestionOpen(false)}
        />
      </EditorModal>
      <EditorModal visible={editSubjectOpen} onRequestClose={() => setEditSubjectOpen(false)}>
        <ManagePyqSubjectSheet
          semesterId={semesterId}
          subject={{
            id: subjectId,
            name: subjectName,
            code: subjectCode,
            questionCount: selectedYear || selectedChapter ? undefined : questionsQ.data?.total,
          }}
          onSaved={() => {
            setEditSubjectOpen(false);
            navigation.goBack();
          }}
          onClose={() => setEditSubjectOpen(false)}
        />
      </EditorModal>

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType={dlg.animationType}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
          <View style={[styles.modalOverlay, dlg.overlay]}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContent,
                  { paddingBottom: insets.bottom + 16, maxWidth: readMaxWidth, width: '100%', alignSelf: 'center' },
                  dlg.sheet,
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

      <QuestionLayoutPromptModal
        visible={layoutPromptVisible}
        onSelect={handleSelectLayoutMode}
      />

      <UploadPaperModal
        visible={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        initialSubjectName={meta?.name || subjectName}
        initialYear={selectedYear}
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
  paperBtnWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  paperBtn: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  paperBtnText: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(13),
    color: '#ffffff',
  },
  manageBtn: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  manageBtnText: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(13),
    color: COLORS.primary,
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
    fontFamily: FONTS.displayBold,
    fontSize: rf(11),
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
    fontFamily: FONTS.displayBold,
    fontSize: rf(11.5),
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
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 1.2,
  },
  modalTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 20,
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
    fontFamily: FONTS.displayBold,
    fontSize: 10.5,
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
    fontFamily: FONTS.displayBold,
    fontSize: 11.5,
    color: COLORS.textMuted,
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
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
