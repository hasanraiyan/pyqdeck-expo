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
              placeholder="Search subjects or questions..."
              placeholderTextColor={COLORS.textSubtle}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
              style={styles.searchInput}
            />
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
                    <View style={styles.resultBadgeRow}>
                      <View style={styles.resultBadgeLeft}>
                        {q.chapter ? (
                          <View style={styles.chapterPill}>
                            <Text style={styles.chapterPillText} numberOfLines={1}>
                              {q.chapter}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.resultBadgeRight}>
                        <Badge label={q.year} variant="secondary" />
                        <MarksBadge marks={q.marks} />
                      </View>
                    </View>
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
  resultBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  resultBadgeLeft: {
    flex: 1,
    paddingRight: 6,
  },
  resultBadgeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  chapterPill: {
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    paddingHorizontal: 6,
    height: 20,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chapterPillText: {
    fontFamily: FONTS.mono,
    fontSize: rf(10),
    color: COLORS.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 14,
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


