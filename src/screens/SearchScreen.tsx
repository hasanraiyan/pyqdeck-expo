import React, { useState } from 'react';
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
import { Feather } from '@expo/vector-icons';
import { searchAllQuestions, searchSubjects } from '../api';
import { COLORS, FONTS } from '../theme/colors';
import { Badge, MarksBadge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import { rf, verticalScale } from '../utils/responsive';

export const SearchScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [subjectResults, setSubjectResults] = useState<any[]>([]);
  const [questionResults, setQuestionResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const [subs, qs] = await Promise.all([
        searchSubjects(q).catch(() => ({ subjects: [] })),
        searchAllQuestions(q).catch(() => ({ questions: [] })),
      ]);
      setSubjectResults(subs.subjects || []);
      setQuestionResults(qs.questions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSubjectResults([]);
    setQuestionResults([]);
    setHasSearched(false);
  };

  const handleSuggestionPress = (term: string) => {
    setQuery(term);
    // Trigger immediate search
    setLoading(true);
    setHasSearched(true);
    Promise.all([
      searchSubjects(term).catch(() => ({ subjects: [] })),
      searchAllQuestions(term).catch(() => ({ questions: [] })),
    ])
      .then(([subs, qs]) => {
        setSubjectResults(subs.subjects || []);
        setQuestionResults(qs.questions || []);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  const SUGGESTED_QUERIES = [
    'Quick sort vs Merge sort',
    'Binary Search Tree',
    '8085 Microprocessor',
    'Operating System Deadlock',
    'Fourier Transform',
    'DBMS Normalization',
    'Thermodynamics',
  ];

  const noResults =
    hasSearched && !loading && subjectResults.length === 0 && questionResults.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with Search Input */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Text style={styles.badgeText}>SEMANTIC & KEYWORD SEARCH</Text>
          <Text style={styles.title}>Search</Text>

          <View style={styles.searchBar}>
            <Feather name="search" size={16} color={COLORS.textMuted} style={styles.searchIcon} />
            <TextInput
              placeholder="Search subjects, questions, or topics..."
              placeholderTextColor={COLORS.textSubtle}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (!text) {
                  setHasSearched(false);
                  setSubjectResults([]);
                  setQuestionResults([]);
                }
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
              style={styles.searchInput}
            />
            {query.length > 0 && !loading && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                <Feather name="x" size={15} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
            {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 24 },
        ]}
      >
        <View style={styles.centerWrapper}>
          {/* Default State: Suggested Search Topics */}
          {!hasSearched && !loading && (
            <View style={styles.suggestedSection}>
              <Text style={styles.suggestedHeading}>TRY SEARCHING FOR</Text>
              <View style={styles.suggestedWrap}>
                {SUGGESTED_QUERIES.map((term, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestedChip}
                    activeOpacity={0.7}
                    onPress={() => handleSuggestionPress(term)}
                  >
                    <Feather name="search" size={12} color={COLORS.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.suggestedChipText}>{term}</Text>
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
                      <Badge label={q.year} variant="secondary" />
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
    marginRight: -4,
  },
  suggestedSection: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  suggestedHeading: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  suggestedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  suggestedChipText: {
    fontFamily: FONTS.mono,
    fontSize: rf(12),
    color: COLORS.text,
    fontWeight: '500',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingVertical: verticalScale(16),
    alignItems: 'center',
  },
  centerWrapper: {
    width: '100%',
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


