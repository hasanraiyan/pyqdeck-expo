import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchAllQuestions, searchSubjects, listAllSubjects, ApiError } from '../api';
import * as Cache from '../db/cacheService';
import { COLORS, FONTS } from '../theme/colors';
import { Badge, MarksBadge, YearBadge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import { rf, verticalScale, useResponsive } from '../utils/responsive';
import { normalizeQuery, consumeSearchToken, shouldDebounceTap, applyServerRetryAfter } from '../utils/searchGuard';

const RECENT_SEARCHES_KEY = 'pyq_recent_searches';

export const SearchScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { contentMaxWidth } = useResponsive();
  const [query, setQuery] = useState('');
  const [subjectResults, setSubjectResults] = useState<any[]>([]);
  const [questionResults, setQuestionResults] = useState<any[]>([]);
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
    if (normalized.toLowerCase() === lastQueryRef.current.toLowerCase() && hasSearched && (subjectResults.length > 0 || questionResults.length > 0)) {
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setValidationError(null);
    try {
      const [subs, qs] = await Promise.all([
        searchSubjects(normalized).catch((e: any) => {
          if (e instanceof ApiError && e.status === 429) throw e;
          return { subjects: [] } as any;
        }),
        searchAllQuestions(normalized).catch((e: any) => {
          if (e instanceof ApiError && e.status === 429) throw e;
          return { questions: [] } as any;
        }),
      ]);

      lastQueryRef.current = normalized;

      // If online results found, set them
      if ((subs.subjects && subs.subjects.length > 0) || (qs.questions && qs.questions.length > 0)) {
        setSubjectResults(subs.subjects || []);
        setQuestionResults(qs.questions || []);
      } else {
        // Fallback to local cache
        const local = await Cache.searchLocalCache(normalized);
        setSubjectResults(local.subjects.map((s: any) => ({ ...s, semester: { id: '', number: 0 } })));
        setQuestionResults(local.questions.map((qu: any) => ({ ...qu, subject: { id: '', name: '', semesterId: '' } })));
      }
    } catch (e: any) {
      // Surface 429 instead of hiding behind offline fallback
      if (e instanceof ApiError && e.status === 429) {
        const retry = e.retryAfterSec ?? 15;
        applyServerRetryAfter(retry);
        startCooldown(retry);
        setValidationError(`Too many searches — try again in ${retry}s`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      }
      // Complete offline fallback for network errors
      try {
        const local = await Cache.searchLocalCache(normalized);
        setSubjectResults(local.subjects.map((s: any) => ({ ...s, semester: { id: '', number: 0 } })));
        setQuestionResults(local.questions.map((qu: any) => ({ ...qu, subject: { id: '', name: '', semesterId: '' } })));
      } catch {
        // keep empty
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
    setHasSearched(false);
    setValidationError(null);
    lastQueryRef.current = '';
  };

  const handleSuggestionPress = (term: string) => {
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
    setLoading(true);
    setHasSearched(true);
    setValidationError(null);

    Promise.all([
      searchSubjects(norm.query).catch((e: any) => {
        if (e instanceof ApiError && e.status === 429) throw e;
        return { subjects: [] } as any;
      }),
      searchAllQuestions(norm.query).catch((e: any) => {
        if (e instanceof ApiError && e.status === 429) throw e;
        return { questions: [] } as any;
      }),
    ])
      .then(async ([subs, qs]) => {
        lastQueryRef.current = norm.query;
        if ((subs.subjects && subs.subjects.length > 0) || (qs.questions && qs.questions.length > 0)) {
          setSubjectResults(subs.subjects || []);
          setQuestionResults(qs.questions || []);
        } else {
          const local = await Cache.searchLocalCache(norm.query);
          setSubjectResults(local.subjects.map((s: any) => ({ ...s, semester: { id: '', number: 0 } })));
          setQuestionResults(local.questions.map((qu: any) => ({ ...qu, subject: { id: '', name: '', semesterId: '' } })));
        }
      })
      .catch(async (e: any) => {
        if (e instanceof ApiError && e.status === 429) {
          const retry = e.retryAfterSec ?? 15;
          applyServerRetryAfter(retry);
          startCooldown(retry);
          setValidationError(`Too many searches — try again in ${retry}s`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          return;
        }
        const local = await Cache.searchLocalCache(norm.query);
        setSubjectResults(local.subjects.map((s: any) => ({ ...s, semester: { id: '', number: 0 } })));
        setQuestionResults(local.questions.map((qu: any) => ({ ...qu, subject: { id: '', name: '', semesterId: '' } })));
      })
      .finally(() => setLoading(false));
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

  const noResults =
    hasSearched && !loading && !validationError && cooldownSec === 0 && subjectResults.length === 0 && questionResults.length === 0;

  const isInputDisabled = loading || cooldownSec > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with Search Input */}
      <View style={styles.header}>
        <View style={[styles.headerInner, { maxWidth: contentMaxWidth }]}>
          <Text style={styles.badgeText}>FIND ANY QUESTION OR TOPIC</Text>
          <Text style={styles.title}>Search</Text>

          <View style={[styles.searchBar, isInputDisabled && styles.searchBarDisabled]}>
            <Feather
              name="search"
              size={16}
              color={COLORS.textMuted}
              style={styles.searchIcon}
            />
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
                  lastQueryRef.current = '';
                }
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
              style={[styles.searchInput, isInputDisabled && { opacity: 0.6 }]}
            />
            {query.length > 0 && !loading && cooldownSec === 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                <Feather name="x" size={15} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
            {loading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 6 }} />}
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
          { paddingBottom: 24 },
        ]}
      >
        <View style={[styles.centerWrapper, { maxWidth: contentMaxWidth }]}>
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
            <View style={{ paddingVertical: 12 }}>
              <Skeleton width={120} height={14} style={{ marginBottom: 12 }} />
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.resultCardSkeleton}>
                  <Skeleton width="40%" height={12} style={{ marginBottom: 6 }} />
                  <Skeleton width="85%" height={16} style={{ marginBottom: 8 }} />
                  <Skeleton width="30%" height={14} />
                </View>
              ))}
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

          {/* Subjects Result Section */}
          {!loading && subjectResults.length > 0 && (
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

          {/* Questions Result Section */}
          {!loading && questionResults.length > 0 && (
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
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
  resultCardSkeleton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 14,
    marginBottom: 10,
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
});
