import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  searchAllQuestions,
  searchSubjects,
  searchTopicNotes,
  listAllSubjects,
  ApiError,
} from '../api';
import { TopicNoteSearchResultItem } from '../types';
import * as Cache from '../db/cacheService';
import { COLORS, FONTS } from '../theme/colors';
import { Badge, MarksBadge, YearBadge } from '../components/Badge';
import { WaveLoader } from '../components/WaveLoader';
import { rf, verticalScale, useResponsive } from '../utils/responsive';
import { normalizeQuery, consumeSearchToken, shouldDebounceTap, applyServerRetryAfter } from '../utils/searchGuard';

const RECENT_SEARCHES_KEY = 'pyq_recent_searches';

type SearchTab = 'all' | 'notes' | 'questions' | 'subjects';

export const SearchScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { readMaxWidth, hPadding } = useResponsive();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [subjectResults, setSubjectResults] = useState<any[]>([]);
  const [questionResults, setQuestionResults] = useState<any[]>([]);
  const [noteResults, setNoteResults] = useState<TopicNoteSearchResultItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);


  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastQueryRef = useRef<string>('');

  // Fetch subjects with actual questions to populate search suggestions
  useEffect(() => {
    listAllSubjects()
      .then((res) => {
        if (res && res.subjects && res.subjects.length > 0) {
          const activeSubjects = res.subjects.filter((s) => (s.questionCount || 0) > 0);
          const names = (activeSubjects.length > 0 ? activeSubjects : res.subjects)
            .slice(0, 6)
            .map((s) => (s.name || '').trim())
            .filter((n) => n.length > 0);
          setDynamicSuggestions(names);
        }
      })
      .catch(() => {});
  }, []);

  // Load recent searches from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((raw) => {
        if (raw) {
          setRecentSearches(JSON.parse(raw));
        }
      })
      .catch(() => {});
  }, []);

  // Cooldown countdown — re-enable input when it hits 0
  useEffect(() => {
    if (cooldownSec <= 0) {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      return;
    }
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownSec((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [cooldownSec]);

  const startCooldown = (sec: number) => {
    setCooldownSec(Math.max(1, Math.round(sec)));
  };

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 6);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const runSearch = async (normalized: string) => {
    // inflight guard — handled by caller, but double-check
    if (loading) return;
    // dedup: skip if same as last successful query and we already have results
    if (
      normalized.toLowerCase() === lastQueryRef.current.toLowerCase() &&
      hasSearched &&
      (subjectResults.length > 0 || questionResults.length > 0 || noteResults.length > 0)
    ) {
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setValidationError(null);
    try {
      const [subsResult, qsResult, notesResult] = await Promise.allSettled([
        searchSubjects(normalized),
        searchAllQuestions(normalized),
        searchTopicNotes(normalized),
      ]);

      const subsData = subsResult.status === 'fulfilled' ? subsResult.value : null;
      const qsData = qsResult.status === 'fulfilled' ? qsResult.value : null;
      const notesData = notesResult.status === 'fulfilled' ? notesResult.value : null;

      const subjectList = Array.isArray(subsData?.subjects) ? subsData.subjects : [];
      const questionList = Array.isArray(qsData?.questions) ? qsData.questions : [];
      const noteList = Array.isArray(notesData?.results) ? notesData.results : [];

      lastQueryRef.current = normalized;

      // Check if rate limited (429) across failing requests
      const isRateLimited =
        (subsResult.status === 'rejected' && (subsResult.reason as any)?.status === 429) ||
        (qsResult.status === 'rejected' && (qsResult.reason as any)?.status === 429) ||
        (notesResult.status === 'rejected' && (notesResult.reason as any)?.status === 429);

      if (isRateLimited && subjectList.length === 0 && questionList.length === 0 && noteList.length === 0) {
        const retry = 15;
        applyServerRetryAfter(retry);
        startCooldown(retry);
        setValidationError(`Too many searches — try again in ${retry}s`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      }

      // If online results found, set them
      if (subjectList.length > 0 || questionList.length > 0 || noteList.length > 0) {
        setSubjectResults(subjectList);
        setQuestionResults(questionList);
        setNoteResults(noteList);
        setActiveTab('all');
      } else {
        // Fallback to local cache if no online results
        try {
          const local = await Cache.searchLocalCache(normalized);
          setSubjectResults((local?.subjects || []).map((s: any) => ({ ...s, semester: { id: '', number: 0 } })));
          setQuestionResults((local?.questions || []).map((qu: any) => ({ ...qu, subject: { id: '', name: '', semesterId: '' } })));
          setNoteResults([]);
          setActiveTab('all');
        } catch {
          setSubjectResults([]);
          setQuestionResults([]);
          setNoteResults([]);
          setActiveTab('all');
        }
      }
    } catch (e: any) {
      // Complete offline fallback for network errors
      try {
        const local = await Cache.searchLocalCache(normalized);
        setSubjectResults((local?.subjects || []).map((s: any) => ({ ...s, semester: { id: '', number: 0 } })));
        setQuestionResults((local?.questions || []).map((qu: any) => ({ ...qu, subject: { id: '', name: '', semesterId: '' } })));
        setNoteResults([]);
        setActiveTab('all');
      } catch {
        setSubjectResults([]);
        setQuestionResults([]);
        setNoteResults([]);
        setActiveTab('all');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (loading || cooldownSec > 0) return;

    const norm = normalizeQuery(query);
    if (!norm.ok) {
      setValidationError(norm.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    const bucket = consumeSearchToken();
    if (!bucket.allowed) {
      startCooldown(bucket.retryAfterSec);
      setValidationError(`Slow down — try again in ${bucket.retryAfterSec}s`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    saveRecentSearch(norm.query);
    await runSearch(norm.query);
  };

  const handleClear = () => {
    setQuery('');
    setSubjectResults([]);
    setQuestionResults([]);
    setNoteResults([]);
    setActiveTab('all');
    setHasSearched(false);
    setValidationError(null);
    lastQueryRef.current = '';
  };

  const handleSuggestionPress = async (term: string) => {
    if (loading || cooldownSec > 0) return;
    if (shouldDebounceTap()) return;

    const norm = normalizeQuery(term);
    if (!norm.ok) {
      setValidationError(norm.error);
      return;
    }

    const bucket = consumeSearchToken();
    if (!bucket.allowed) {
      startCooldown(bucket.retryAfterSec);
      setValidationError(`Slow down — try again in ${bucket.retryAfterSec}s`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    setQuery(norm.query);
    saveRecentSearch(norm.query);
    await runSearch(norm.query);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => {});
  };

  const activeSuggestions = dynamicSuggestions.length > 0 ? dynamicSuggestions : [
    'Operating System',
    'Data Structures & Algorithms',
    'Computer Organization',
    'Analog Electronics',
    'Digital Electronics',
    'Engineering Mathematics',
  ];

  const totalResultsCount = subjectResults.length + questionResults.length + noteResults.length;

  const noResults =
    hasSearched &&
    !loading &&
    !validationError &&
    cooldownSec === 0 &&
    totalResultsCount === 0;

  const isInputDisabled = loading || cooldownSec > 0;

  const renderNoteCard = (note: TopicNoteSearchResultItem) => (
    <TouchableOpacity
      key={`${note.subjectSlug}-${note.topicId}`}
      style={styles.noteResultCard}
      activeOpacity={0.7}
      onPress={() =>
        // Must match the shape TopicNotesScreen destructures - it reads a
        // `topic` object and `subjectId`, so passing topicId/subject flat
        // left topic undefined and rendered "No topic selected."
        navigation.navigate('TopicNotes', {
          topic: { id: note.topicId, title: note.topicTitle },
          subjectId: note.subjectSlug,
          subjectName: note.subjectName,
          moduleId: note.moduleId,
          moduleName: note.moduleTitle,
          semesterId: note.semester ? `sem-${note.semester}` : undefined,
          notesList: [
            {
              id: note.topicId,
              title: note.topicTitle,
              moduleId: note.moduleId,
              moduleName: note.moduleTitle,
            },
          ],
        })
      }
    >
      <Text style={styles.resultSubjectName} numberOfLines={1}>
        {note.subjectName}
        {note.moduleNumber ? ` · Module ${note.moduleNumber}` : ''}
      </Text>

      <Text style={styles.noteTitle}>{note.topicTitle}</Text>

      {note.snippet ? (
        <Text style={styles.noteSnippet} numberOfLines={2}>
          {note.snippet}
        </Text>
      ) : null}

      <View style={styles.noteFooter}>
        <Text style={styles.noteModuleTitle} numberOfLines={1}>
          {note.moduleTitle}
        </Text>
        <View style={styles.readNoteLink}>
          <Text style={styles.readNoteLinkText}>Read Note</Text>
          <Feather name="arrow-right" size={12} color={COLORS.primary} style={{ marginLeft: 4 }} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with Search Input */}
      <View style={styles.header}>
        <View
          style={[
            styles.headerInner,
            { maxWidth: readMaxWidth + hPadding * 2, paddingHorizontal: hPadding },
          ]}
        >
          <Text style={styles.badgeText}>FIND ANY QUESTION OR TOPIC</Text>
          <Text style={styles.title}>Search</Text>

          <View style={[styles.searchBar, isInputDisabled && styles.searchBarDisabled]}>
            <TouchableOpacity
              onPress={handleSearch}
              disabled={isInputDisabled}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.searchIconBtn}
            >
              <Feather
                name="search"
                size={16}
                color={query.trim().length > 0 ? COLORS.primary : COLORS.textMuted}
              />
            </TouchableOpacity>
            <TextInput
              placeholder={cooldownSec > 0 ? `Cooldown ${cooldownSec}s...` : 'Search subjects, questions, or topics...'}
              placeholderTextColor={COLORS.textSubtle}
              value={query}
              editable={!isInputDisabled}
              onChangeText={(text) => {
                setQuery(text);
                if (validationError) setValidationError(null);
                if (!text) {
                  setHasSearched(false);
                  setSubjectResults([]);
                  setQuestionResults([]);
                  setNoteResults([]);
                  setActiveTab('all');
                  lastQueryRef.current = '';
                }
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              blurOnSubmit={true}
              enablesReturnKeyAutomatically={true}
              autoCorrect={false}
              style={[styles.searchInput, isInputDisabled && { opacity: 0.6 }]}
            />
            {query.length > 0 && !loading && cooldownSec === 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={15} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}

            {query.trim().length > 0 && !loading && cooldownSec === 0 && (
              <TouchableOpacity
                onPress={handleSearch}
                style={styles.searchActionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="arrow-right" size={15} color={COLORS.primary} />
              </TouchableOpacity>
            )}

            {cooldownSec > 0 && !loading && <Feather name="clock" size={14} color={COLORS.textMuted} style={{ marginLeft: 6 }} />}
          </View>
          {validationError && (
            <View style={styles.validationRow}>
              <Feather name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.validationText}>{validationError}</Text>
            </View>
          )}
          {cooldownSec > 0 && !validationError && (
            <View style={styles.validationRow}>
              <Feather name="clock" size={12} color={COLORS.textMuted} style={{ marginRight: 6 }} />
              <Text style={styles.cooldownText}>Slow down — try again in {cooldownSec}s</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 24, paddingHorizontal: hPadding },
        ]}
      >
        <View style={[styles.centerWrapper, { maxWidth: readMaxWidth }]}>
          {/* Default State: Recent Searches & Suggested Search Topics */}
          {!hasSearched && !loading && (
            <View style={styles.suggestedSection}>
              {recentSearches.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <View style={styles.recentHeaderRow}>
                    <Text style={styles.suggestedHeading}>RECENT SEARCHES</Text>
                    <TouchableOpacity onPress={clearRecentSearches} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.clearRecentText}>Clear all</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.suggestedList}>
                    {recentSearches.map((term, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.suggestedRow, isInputDisabled && { opacity: 0.5 }]}
                        activeOpacity={0.7}
                        disabled={isInputDisabled}
                        onPress={() => handleSuggestionPress(term)}
                      >
                        <View style={styles.suggestedRowLeft}>
                          <Feather name="clock" size={13} color={COLORS.textMuted} style={{ marginRight: 10 }} />
                          <Text style={styles.suggestedRowText}>{term}</Text>
                        </View>
                        <Feather name="arrow-up-left" size={14} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <Text style={styles.suggestedHeading}>
                {recentSearches.length > 0 ? 'EXPLORE LIVE SUBJECTS' : 'POPULAR SUBJECT TOPICS'}
              </Text>
              <View style={styles.suggestedList}>
                {activeSuggestions.map((term, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.suggestedRow, isInputDisabled && { opacity: 0.5 }]}
                    activeOpacity={0.7}
                    disabled={isInputDisabled}
                    onPress={() => handleSuggestionPress(term)}
                  >
                    <View style={styles.suggestedRowLeft}>
                      <Feather name="book-open" size={13} color={COLORS.primary} style={{ marginRight: 10 }} />
                      <Text style={styles.suggestedRowText}>{term}</Text>
                    </View>
                    <Feather name="arrow-up-left" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {loading ? (
            <View style={styles.loaderBox}>
              <WaveLoader color={COLORS.primary} dotSize={7} />
            </View>
          ) : null}

          {noResults && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>
                Try a shorter or differently-spelled search term.
              </Text>
            </View>
          )}

          {/* Filter Tabs Row */}
          {!loading && hasSearched && !noResults && (
            <View style={styles.filterTabsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterTabsRow}
              >
                <TouchableOpacity
                  style={[styles.filterTabPill, activeTab === 'all' && styles.filterTabPillActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveTab('all');
                  }}
                >
                  <Text style={[styles.filterTabPillText, activeTab === 'all' && styles.filterTabPillTextActive]}>
                    All ({totalResultsCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTabPill, activeTab === 'questions' && styles.filterTabPillActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveTab('questions');
                  }}
                >
                  <Feather
                    name="help-circle"
                    size={12}
                    color={activeTab === 'questions' ? '#ffffff' : COLORS.textMuted}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.filterTabPillText, activeTab === 'questions' && styles.filterTabPillTextActive]}>
                    Questions ({questionResults.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTabPill, activeTab === 'notes' && styles.filterTabPillActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveTab('notes');
                  }}
                >
                  <Feather
                    name="book-open"
                    size={12}
                    color={activeTab === 'notes' ? '#ffffff' : COLORS.textMuted}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.filterTabPillText, activeTab === 'notes' && styles.filterTabPillTextActive]}>
                    Notes ({noteResults.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTabPill, activeTab === 'subjects' && styles.filterTabPillActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveTab('subjects');
                  }}
                >
                  <Feather
                    name="folder"
                    size={12}
                    color={activeTab === 'subjects' ? '#ffffff' : COLORS.textMuted}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.filterTabPillText, activeTab === 'subjects' && styles.filterTabPillTextActive]}>
                    Subjects ({subjectResults.length})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* Subjects Result Section */}
          {!loading && (activeTab === 'all' || activeTab === 'subjects') && subjectResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                SUBJECTS ({subjectResults.length})
              </Text>
              <View style={styles.subjectsGrid}>
                {subjectResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.subjectCard}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate('SubjectDetail', {
                        semesterId: item.semester?.id,
                        subjectId: item.id,
                        subjectName: item.name,
                        subjectCode: item.code,
                      })
                    }
                  >
                    <View style={styles.subjectLeft}>
                      <Text style={styles.subjectName}>{item.name}</Text>
                      <Text style={styles.subjectSub}>
                        Semester {item.semester?.number}
                        {item.code ? ` · ${item.code}` : ''}
                      </Text>
                    </View>
                    <View style={styles.subjectRight}>
                      <Text style={styles.questionCountText}>
                        {item.questionCount}q
                      </Text>
                      <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Empty Subjects Tab */}
          {!loading && activeTab === 'subjects' && subjectResults.length === 0 && (
            <View style={styles.tabEmptyContainer}>
              <Feather name="folder" size={24} color={COLORS.textSubtle} style={{ marginBottom: 8 }} />
              <Text style={styles.tabEmptyTitle}>No matching subjects</Text>
              <Text style={styles.tabEmptySubtitle}>Try searching by subject name or course code.</Text>
            </View>
          )}

          {/* Questions Result Section */}
          {!loading && (activeTab === 'all' || activeTab === 'questions') && questionResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                QUESTIONS ({questionResults.length})
              </Text>
              <View style={{ gap: 10 }}>
                {questionResults.map((q) => (
                  <TouchableOpacity
                    key={`${q.subject?.id || 's'}-${q.questionId}`}
                    style={styles.questionResultCard}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate('QuestionDetail', {
                        subjectId: q.subject?.id,
                        semesterId: q.subject?.semesterId,
                        questionId: q.questionId,
                        initialQuestion: q,
                        subjectName: q.subject?.name,
                      })
                    }
                  >
                    <Text style={styles.resultSubjectName}>
                      {q.subject?.name}
                      {typeof q.score === 'number'
                        ? ` · ${q.score.toFixed(3)} match`
                        : ''}
                    </Text>
                    <Text style={styles.resultTextPreview} numberOfLines={2}>
                      {q.textPreview || q.text}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.resultBadgeScroll}
                      nestedScrollEnabled
                    >
                      {q.year ? <YearBadge year={q.year} /> : null}
                      <MarksBadge marks={q.marks} />
                      {q.chapter ? (
                        <View style={styles.chapterPill}>
                          <Text style={styles.chapterPillText}>
                            {q.chapter}
                          </Text>
                        </View>
                      ) : null}
                    </ScrollView>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Empty Questions Tab */}
          {!loading && activeTab === 'questions' && questionResults.length === 0 && (
            <View style={styles.tabEmptyContainer}>
              <Feather name="help-circle" size={24} color={COLORS.textSubtle} style={{ marginBottom: 8 }} />
              <Text style={styles.tabEmptyTitle}>No matching exam questions</Text>
              <Text style={styles.tabEmptySubtitle}>
                Try searching for questions with different keywords.
              </Text>
            </View>
          )}

          {/* Study Notes Result Section */}
          {!loading && (activeTab === 'all' || activeTab === 'notes') && noteResults.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>
                  STUDY NOTES ({noteResults.length})
                </Text>
                {activeTab === 'all' && noteResults.length > 3 && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setActiveTab('notes');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.seeAllLink}>View all {noteResults.length} →</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ gap: 10 }}>
                {(activeTab === 'all' ? noteResults.slice(0, 3) : noteResults).map((note) =>
                  renderNoteCard(note)
                )}
              </View>
            </View>
          )}

          {/* Empty Notes Tab */}
          {!loading && activeTab === 'notes' && noteResults.length === 0 && (
            <View style={styles.tabEmptyContainer}>
              <Feather name="book-open" size={24} color={COLORS.textSubtle} style={{ marginBottom: 8 }} />
              <Text style={styles.tabEmptyTitle}>No matching study notes</Text>
              <Text style={styles.tabEmptySubtitle}>
                Try searching for broader topic or concept names.
              </Text>
            </View>
          )}

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
  header: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 16,
  },
  badgeText: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: rf(27),
    fontWeight: '400',
    fontStyle: 'italic',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    marginTop: 12,
    height: 42,
  },
  searchBarDisabled: {
    opacity: 0.7,
    backgroundColor: COLORS.cardSecondary,
  },
  searchBarListening: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchIconBtn: {
    paddingRight: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchActionBtn: {
    padding: 6,
    marginLeft: 2,
    backgroundColor: COLORS.cardSecondary,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: rf(13.5),
  },
  clearBtn: {
    padding: 6,
    marginRight: 2,
  },
  micBtn: {
    padding: 5,
    borderRadius: 4,
    marginLeft: 2,
  },
  micBtnActive: {
    backgroundColor: COLORS.primary,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  validationText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    color: '#DC2626',
    flex: 1,
  },
  cooldownText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    color: COLORS.textMuted,
    flex: 1,
  },
  scroll: {
    paddingVertical: verticalScale(16),
  },
  centerWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  suggestedSection: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 24,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  clearRecentText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    color: COLORS.primary,
    fontWeight: '600',
  },
  suggestedHeading: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  suggestedList: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  suggestedRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  suggestedRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  suggestedRowText: {
    fontFamily: FONTS.mono,
    fontSize: rf(12.5),
    color: COLORS.text,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  subjectsGrid: {
    gap: 8,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 14,
  },
  subjectLeft: {
    flex: 1,
    paddingRight: 12,
  },
  subjectName: {
    fontSize: rf(14.5),
    fontWeight: '600',
    color: COLORS.text,
  },
  subjectSub: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    color: COLORS.textMuted,
    marginTop: 4,
  },
  subjectRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionCountText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11.5),
    color: COLORS.textMuted,
  },
  questionResultCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 14,
  },
  resultSubjectName: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    color: COLORS.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  resultTextPreview: {
    fontFamily: FONTS.serif,
    fontSize: rf(14),
    color: COLORS.text,
    lineHeight: rf(21),
  },
  resultBadgeScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingRight: 10,
  },
  chapterPill: {
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    paddingHorizontal: 8,
    height: 22,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  chapterPillText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    color: COLORS.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 15,
  },
  loaderBox: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: rf(16),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: rf(13),
    color: COLORS.textMuted,
  },
  filterTabsContainer: {
    marginBottom: 16,
    marginHorizontal: -4,
  },
  filterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  filterTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  filterTabPillActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  filterTabPillText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11.5),
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  filterTabPillTextActive: {
    color: '#ffffff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  seeAllLink: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    color: COLORS.primary,
    fontWeight: '600',
  },
  noteResultCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 14,
  },
  noteTitle: {
    fontFamily: FONTS.serif,
    fontSize: rf(15),
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: rf(21),
    marginBottom: 6,
  },
  noteSnippet: {
    fontSize: rf(12.5),
    color: COLORS.textMuted,
    lineHeight: rf(18),
    marginBottom: 10,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 8,
    marginTop: 2,
  },
  noteModuleTitle: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    color: COLORS.textSubtle,
    flex: 1,
    marginRight: 8,
  },
  readNoteLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readNoteLinkText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '600',
    color: COLORS.primary,
  },
  tabEmptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  tabEmptyTitle: {
    fontSize: rf(14.5),
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  tabEmptySubtitle: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
