import React, { useState, useEffect, useMemo, useRef } from 'react';
import { logEvent } from '../utils/analytics';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLinkTo, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api';
import {
  searchSubjectsQuery,
  searchQuestionsQuery,
  searchNotesQuery,
  aiOverviewStatusQuery,
  aiOverviewQuery,
  allSubjectsQuery,
  isSearchCached,
} from '../api/queries';
import { prefetchSubject } from '../api/prefetch';
import { TopicNoteSearchResultItem, AiOverviewReference } from '../types';
import { AiOverviewCard } from '../components/AiOverviewCard';
import { searchLocalCache } from '../api/offlineSearch';
import { COLORS, FONTS } from '../theme/colors';
import { Badge, MarksBadge, YearBadge } from '../components/Badge';
import { CircleLoader } from '../components/CircleLoader';
import { rf, verticalScale, useResponsive } from '../utils/responsive';
import { normalizeQuery, consumeSearchToken, shouldDebounceTap, applyServerRetryAfter } from '../utils/searchGuard';
import { ScreenContainer } from '../components/ScreenContainer';

const RECENT_SEARCHES_KEY = 'pyq_recent_searches';

type SearchTab = 'all' | 'notes' | 'questions' | 'subjects';

export const SearchScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const linkTo = useLinkTo();
  const { readMaxWidth, hPadding, compact } = useResponsive();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const queryClient = useQueryClient();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  // The validated query the results below belong to. null = nothing submitted.
  // Everything on screen is derived from React Query for this string, so a new
  // submit cancels the old requests and a repeat is served from cache.
  const [submitted, setSubmitted] = useState<string | null>(null);
  const hasSearched = submitted !== null;
  useEffect(() => {
    // Length only - the query text itself can be personal.
    if (submitted) logEvent('search', { query_length: submitted.length });
  }, [submitted]);
  const q = submitted ?? '';

  const subsQ = useQuery({ ...searchSubjectsQuery(q), enabled: hasSearched });
  const qsQ = useQuery({ ...searchQuestionsQuery(q), enabled: hasSearched });
  const notesQ = useQuery({ ...searchNotesQuery(q), enabled: hasSearched });
  const loading = hasSearched && (subsQ.isFetching || qsQ.isFetching || notesQ.isFetching);

  // The overview is a bonus on top of real results: it starts only once the
  // three searches have settled, and a failure just means no card.
  const aiStatusQ = useQuery(aiOverviewStatusQuery());
  const aiQ = useQuery({
    ...aiOverviewQuery(q),
    enabled: hasSearched && !loading && aiStatusQ.data === true,
  });
  const aiOverview = aiQ.data ?? null;
  const aiLoading = aiQ.isFetching;

  const onlineSubjects = Array.isArray(subsQ.data?.subjects) ? subsQ.data.subjects : [];
  const onlineQuestions = Array.isArray(qsQ.data?.questions) ? qsQ.data.questions : [];
  const noteResults: TopicNoteSearchResultItem[] = Array.isArray(notesQ.data?.results)
    ? notesQ.data.results
    : [];
  const onlineEmpty =
    hasSearched &&
    !loading &&
    onlineSubjects.length === 0 &&
    onlineQuestions.length === 0 &&
    noteResults.length === 0;

  // Offline / no-hit fallback over whatever React Query already holds.
  const [localResults, setLocalResults] = useState<{ subjects: any[]; questions: any[] } | null>(
    null
  );
  useEffect(() => {
    if (!onlineEmpty || !submitted) {
      setLocalResults(null);
      return;
    }
    let current = true;
    searchLocalCache(submitted)
      .then((local) => {
        if (current) setLocalResults({ subjects: local?.subjects ?? [], questions: local?.questions ?? [] });
      })
      .catch(() => {
        if (current) setLocalResults(null);
      });
    return () => {
      current = false;
    };
  }, [onlineEmpty, submitted]);

  const subjectResults: any[] = useMemo(
    () =>
      onlineEmpty
        ? (localResults?.subjects ?? []).map((s: any) => ({ ...s, semester: { id: '', number: 0 } }))
        : onlineSubjects,
    [onlineEmpty, localResults, onlineSubjects]
  );
  const questionResults: any[] = useMemo(
    () =>
      onlineEmpty
        ? (localResults?.questions ?? []).map((qu: any) => ({
            ...qu,
            subject: qu.subject ?? { id: '', name: '', semesterId: '' },
          }))
        : onlineQuestions,
    [onlineEmpty, localResults, onlineQuestions]
  );

  const questionKey = (q: any) => `${q.subject?.id || 's'}-${q.questionId}`;
  const openQuestion = (qu: any) =>
    navigation.navigate('QuestionDetail', {
      subjectId: qu.subject?.id,
      semesterId: qu.subject?.semesterId,
      questionId: qu.questionId,
      initialQuestion: qu,
      subjectName: qu.subject?.name,
    });

  // Suggestion chips reuse the All Subjects cache (first page) instead of
  // fetching on every mount.
  const suggestionsQ = useInfiniteQuery(allSubjectsQuery(''));
  const dynamicSuggestions = useMemo(() => {
    const subjects = suggestionsQ.data?.pages[0]?.subjects ?? [];
    const active = subjects.filter((s) => (s.questionCount || 0) > 0);
    return (active.length > 0 ? active : subjects)
      .slice(0, 6)
      .map((s) => (s.name || '').trim())
      .filter((n) => n.length > 0);
  }, [suggestionsQ.data]);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const openAiReference = (ref: AiOverviewReference) => {
    // Preferred: the server's canonical URL, but routed into THIS tab's own
    // stack - never via linkTo(). linkTo() resolves these paths into the
    // Syllabus/Browse stacks, and when that stack isn't mounted yet the
    // target becomes its root: no back button, no way back to results (or
    // to the Study home). SearchStack registers TopicNotes, QuestionDetail
    // and QuestionList (see App.tsx), so a plain navigate pushes over the
    // search results with the header back intact. Regex, not new URL():
    // Hermes has no URL global to rely on.
    const raw = ref.url;
    if (raw) {
      const m = raw.match(/^https:\/\/(www\.)?pyqdeck\.in(\/[^?#]*)?(\?[^#]*)?/);
      if (m) {
        const path = m[2] || '/';
        const topic = path.match(/^\/syllabus\/subject\/([^/]+)\/topic\/([^/]+)/);
        if (topic) {
          // Bare ids - the resolver on TopicNotesScreen fills in the
          // title/module, same as a deep link.
          navigation.navigate('TopicNotes', { subjectId: topic[1], topicId: topic[2] });
          return;
        }
        const parts = path.split('/').filter(Boolean);
        const year = parts.length >= 3 ? Number(parts[2]) : NaN;
        if (!Number.isNaN(year)) {
          if (parts.length === 4) {
            navigation.navigate('QuestionDetail', {
              semesterId: parts[0],
              subjectId: parts[1],
              year,
              questionId: parts[3],
            });
            return;
          }
          if (parts.length === 3 && parts[0] !== 'syllabus') {
            navigation.navigate('QuestionList', {
              semesterId: parts[0],
              subjectId: parts[1],
              year,
            });
            return;
          }
        }
        // Anything else (semester sheets, /search) is owned by other stacks -
        // those still go through the deep-link config.
        try {
          linkTo(path + (m[3] || ''));
          return;
        } catch {
          // Unmatched path (a route the app does not know yet) - fall
          // through to the param-based handling below, then give up.
        }
      }
    }
    // Fallback for cached payloads from before `url` existed.
    const nav = ref.navigate;
    if (!nav) return;
    if (nav.target === 'topic' && nav.subjectSlug && nav.topicId) {
      // A cited study note - the resolver on TopicNotesScreen fills in the
      // title/module from the bare ids, same as a deep link.
      navigation.navigate('TopicNotes', {
        subjectId: nav.subjectSlug,
        topicId: nav.topicId,
      });
      return;
    }
    if (nav.target === 'question') {
      navigation.navigate('QuestionDetail', {
        subjectId: nav.subjectId,
        semesterId: nav.semesterId,
        questionId: nav.questionId,
        year: nav.year,
      });
      return;
    }
    // A whole paper rather than one question.
    navigation.navigate('QuestionList', {
      subjectId: nav.subjectId,
      semesterId: nav.semesterId,
      year: nav.year,
    });
  };

  // Shared by typed searches, suggestion taps and deep links. A new value here
  // unmounts the previous query's observers, which cancels its in-flight
  // requests (each fetcher forwards React Query's signal).
  const submitQuery = (normalized: string) => {
    setValidationError(null);
    setActiveTab('all');
    // Re-submitting the same text: React Query sees no key change, and the
    // search options disable retries, so a failed search would just sit in its
    // error state. Re-run whichever of the three failed.
    if (normalized.toLowerCase() === submitted?.toLowerCase()) {
      [subsQ, qsQ, notesQ].forEach((x) => {
        if (x.isError) void x.refetch();
      });
    }
    setSubmitted(normalized);
    saveRecentSearch(normalized);
  };

  // Spends a rate-limit token only when a request will really be sent: a repeat
  // of a search still in the cache is free, so re-running a query never trips
  // the cooldown. Returns false (and shows the message) when blocked.
  const allowSearch = (normalized: string): boolean => {
    if (isSearchCached(queryClient, normalized)) return true;
    const bucket = consumeSearchToken();
    if (bucket.allowed) return true;
    startCooldown(bucket.retryAfterSec);
    setValidationError(`Slow down — try again in ${bucket.retryAfterSec}s`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    return false;
  };

  // A real server 429 (from any of the three searches) starts a cooldown using
  // the server's own Retry-After, falling back to 15s when it sent none. Only
  // when nothing else came back, so a partial result is never hidden.
  useEffect(() => {
    if (!hasSearched || loading) return;
    const limited = [subsQ.error, qsQ.error, notesQ.error].find(
      (e) => e instanceof ApiError && e.status === 429
    ) as ApiError | undefined;
    if (!limited || !onlineEmpty) return;
    const retry = limited.retryAfterSec && limited.retryAfterSec > 0 ? limited.retryAfterSec : 15;
    applyServerRetryAfter(retry);
    startCooldown(retry);
    setValidationError(`Too many searches — try again in ${Math.min(60, Math.round(retry))}s`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSearched, loading, onlineEmpty, subsQ.error, qsQ.error, notesQ.error]);

  const handleSearch = () => {
    if (cooldownSec > 0) return;

    const norm = normalizeQuery(query);
    if (!norm.ok) {
      setValidationError(norm.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    if (!allowSearch(norm.query)) return;
    submitQuery(norm.query);
  };

  const handleClear = () => {
    setQuery('');
    setSubmitted(null);
    setActiveTab('all');
    setValidationError(null);
  };

  const handleSuggestionPress = (term: string) => {
    if (cooldownSec > 0) return;
    if (shouldDebounceTap()) return;

    const norm = normalizeQuery(term);
    if (!norm.ok) {
      setValidationError(norm.error);
      return;
    }
    if (!allowSearch(norm.query)) return;

    setQuery(norm.query);
    submitQuery(norm.query);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => {});
  };

  // Deep-link entry: a shared `pyqdeck.in/search?q=...&tab=...` URL lands here
  // with `q`/`tab` params (see the linking config in App.tsx). Run it once per
  // query value - the same validation + token-bucket path as a typed search.
  const deepLinkQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const initQ = typeof route.params?.q === 'string' ? route.params.q : '';
    if (!initQ.trim() || initQ === deepLinkQueryRef.current) return;
    const initTab = route.params?.tab;
    if (initTab === 'all' || initTab === 'notes' || initTab === 'questions' || initTab === 'subjects') {
      setActiveTab(initTab);
    }
    const norm = normalizeQuery(initQ);
    if (!norm.ok) {
      setValidationError(norm.error);
      return;
    }
    if (!allowSearch(norm.query)) return;
    deepLinkQueryRef.current = initQ;
    setQuery(norm.query);
    submitQuery(norm.query);
    // allowSearch/submitQuery are read from this render's closure on purpose:
    // the effect must run once per deep-linked query value, not per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.q]);

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

  // Only a cooldown locks the input. A search in flight never does: typing a
  // new query and submitting simply cancels the old one.
  const isInputDisabled = cooldownSec > 0;

  const renderNoteCard = (note: TopicNoteSearchResultItem) => (
    <TouchableOpacity
      key={`${note.subjectSlug}-${note.topicId}`}
      style={[styles.noteResultCard, compact && styles.cardCompact]}
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
                  setSubmitted(null);
                  setActiveTab('all');
                }
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              blurOnSubmit={true}
              enablesReturnKeyAutomatically={true}
              autoCorrect={false}
              style={[styles.searchInput, isInputDisabled && { opacity: 0.6 }]}
            />
            {query.length > 0 && cooldownSec === 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={15} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}

            {query.trim().length > 0 && cooldownSec === 0 && (
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
          { paddingBottom: 24 },
        ]}
      >
        <ScreenContainer variant="read">
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
              <CircleLoader color={COLORS.primary} dotSize={6} size={40} />
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

          {/* AI overview - above the results it summarises, hidden when the
              feature is off or the query produced no summary. */}
          {!loading && hasSearched && (aiLoading || aiOverview) && (
            <AiOverviewCard
              overview={aiOverview}
              loading={aiLoading}
              onPressReference={openAiReference}
            />
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
                    style={[styles.subjectCard, compact && styles.cardCompact]}
                    activeOpacity={0.7}
                    onPress={() => {
                      prefetchSubject(item.id);
                      navigation.navigate('SubjectDetail', {
                        semesterId: item.semester?.id,
                        subjectId: item.id,
                        subjectName: item.name,
                        subjectCode: item.code,
                      });
                    }}
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
                    key={questionKey(q)}
                    style={[
                      styles.questionResultCard,
                      compact && styles.cardCompact,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => openQuestion(q)}
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

        </ScreenContainer>
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
  // Tighter padding on pointer-first windows (FR-C1).
  cardCompact: { padding: 10 },
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
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
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
